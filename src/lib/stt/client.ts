import { VADClient, type VADConfig, type VADCallbacks } from './vad';
import { WhisperClient, type WhisperConfig, type TranscriptionResult } from './whisper';
import {
	ResilientOperationManager,
	type CircuitBreakerConfig,
	type RetryConfig
} from './resilience';
import { env } from '$env/dynamic/private';

export interface STTConfig {
	vad: VADConfig;
	whisper: WhisperConfig;
	autoStart?: boolean;
	// Global resilience settings for the entire STT system
	circuitBreaker?: Partial<CircuitBreakerConfig>;
	retry?: Partial<RetryConfig>;
}

export interface STTCallbacks {
	onTranscriptionResult?: (result: TranscriptionResult) => void;
	onSpeechStart?: () => void;
	onSpeechEnd?: () => void;
	onError?: (error: Error) => void;
	onStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'error') => void;
}

export type STTStatus = 'idle' | 'listening' | 'processing' | 'error';

export class UnifiedSTTClient {
	private vadClient: VADClient;
	private whisperClient: WhisperClient;
	private config: STTConfig;
	private callbacks: STTCallbacks;
	private status: STTStatus = 'idle';
	private isInitialized = false;
	private readonly resilientOps: ResilientOperationManager;
	private recoveryAttempts = 0;
	private readonly maxRecoveryAttempts = 3;

	constructor(config?: Partial<STTConfig>, callbacks: STTCallbacks = {}) {
		this.config = {
			vad: {
				startOnLoad: false,
				positiveSpeechThreshold: Number(env.VAD_POSITIVE_THRESHOLD) || 0.8,
				negativeSpeechThreshold: Number(env.VAD_NEGATIVE_THRESHOLD) || 0.35,
				minSpeechFrames: Number(env.VAD_MIN_SPEECH_FRAMES) || 5,
				...config?.vad
			},
			whisper: {
				modelId: env.WHISPER_MODEL_ID || 'Xenova/whisper-tiny.en',
				dtype: (env.WHISPER_DTYPE as WhisperConfig['dtype']) || 'q4',
				device: (env.WHISPER_DEVICE as WhisperConfig['device']) || 'wasm',
				returnTimestamps: config?.whisper?.returnTimestamps || false,
				language: env.WHISPER_LANGUAGE || 'en',
				task: (env.WHISPER_TASK as WhisperConfig['task']) || 'transcribe',
				...config?.whisper
			},
			autoStart: config?.autoStart ?? false,
			circuitBreaker: {
				failureThreshold: Number(env.STT_CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 5,
				resetTimeoutMs: Number(env.STT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS) || 60000,
				monitoringWindowMs: Number(env.STT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS) * 5 || 300000,
				...config?.circuitBreaker
			},
			retry: {
				maxAttempts: Number(env.STT_RETRY_MAX_ATTEMPTS) || 3,
				baseDelayMs: Number(env.STT_RETRY_BASE_DELAY_MS) || 1000,
				maxDelayMs: Number(env.STT_RETRY_MAX_DELAY_MS) || 10000,
				backoffMultiplier: 2,
				jitterMs: 100,
				...config?.retry
			}
		};

		this.callbacks = callbacks;

		// Initialize VAD with speech end callback
		const vadCallbacks: VADCallbacks = {
			onSpeechStart: () => {
				console.log('[STT] Speech started');
				this.setStatus('listening');
				this.callbacks.onSpeechStart?.();
			},
			onSpeechEnd: async (audio: Float32Array) => {
				console.log(`[STT] Speech ended, processing ${audio.length} samples`);
				this.setStatus('processing');
				this.callbacks.onSpeechEnd?.();

				try {
					// Pass raw PCM to Whisper. Transformers.js accepts Float32Array @ 16kHz
					const result = await this.whisperClient.transcribe(audio);
					this.callbacks.onTranscriptionResult?.(result);
					this.setStatus('listening'); // Return to listening state
				} catch (error) {
					console.error('[STT] Transcription error:', error);
					const errorObj =
						error instanceof Error ? error : new Error('Unknown transcription error');
					this.callbacks.onError?.(errorObj);
					this.setStatus('error');
				}
			},
			onVADMisfire: (audio: Float32Array) => {
				console.log(`[STT] VAD misfire detected: ${audio.length} samples`);
			}
		};

		// Initialize resilient operations for the entire STT system
		this.resilientOps = new ResilientOperationManager(
			this.config.circuitBreaker,
			this.config.retry
		);

		this.vadClient = new VADClient(this.config.vad, vadCallbacks);
		this.whisperClient = new WhisperClient({
			...this.config.whisper,
			// Pass resilience config to Whisper client
			circuitBreaker: this.config.circuitBreaker,
			retry: this.config.retry
		});
	}

	private setStatus(status: STTStatus): void {
		if (this.status !== status) {
			this.status = status;
			console.log(`[STT] Status changed to: ${status}`);
			this.callbacks.onStatusChange?.(status);
		}
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			console.log('[STT] Initializing Speech-to-Text system...');

			// Initialize VAD and Whisper in parallel
			await Promise.all([
				this.vadClient.initialize(),
				this.whisperClient.transcribe(new Float32Array(16000).fill(0)) // Warm up Whisper
			]);

			this.isInitialized = true;
			this.setStatus('idle');

			console.log('[STT] Speech-to-Text system initialized successfully');

			if (this.config.autoStart) {
				await this.start();
			}
		} catch (error) {
			console.error('[STT] Failed to initialize:', error);
			this.setStatus('error');
			const errorObj = error instanceof Error ? error : new Error('Unknown initialization error');
			this.callbacks.onError?.(errorObj);
			throw errorObj;
		}
	}

	async start(): Promise<void> {
		await this.initialize();

		if (this.status === 'listening') {
			console.log('[STT] Already listening');
			return;
		}

		// Use resilient operations for starting
		return this.resilientOps
			.execute(
				async () => {
					await this.vadClient.start();
					this.setStatus('listening');
					this.recoveryAttempts = 0; // Reset on successful start
					console.log('[STT] Started listening for speech', {
						timestamp: new Date().toISOString()
					});
				},
				'STT-Start',
				(error) => {
					// Most start errors are retryable (permissions might be temporary)
					return true;
				}
			)
			.catch(async (error) => {
				console.error('[STT] Failed to start after all retry attempts:', error);
				this.setStatus('error');
				const errorObj = error instanceof Error ? error : new Error('Unknown start error');
				this.callbacks.onError?.(errorObj);

				// Attempt automatic recovery if we haven't exceeded max attempts
				if (this.recoveryAttempts < this.maxRecoveryAttempts) {
					await this.attemptRecovery();
				}

				throw errorObj;
			});
	}

	private async attemptRecovery(): Promise<void> {
		this.recoveryAttempts++;
		console.log(
			`[STT] Attempting automatic recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})`,
			{
				timestamp: new Date().toISOString()
			}
		);

		try {
			// Reset circuit breakers
			this.resetCircuitBreakers();

			// Destroy and reinitialize components
			this.destroy();
			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

			// Try to reinitialize
			await this.initialize();

			console.log(`[STT] Recovery attempt ${this.recoveryAttempts} completed`, {
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			console.error(`[STT] Recovery attempt ${this.recoveryAttempts} failed:`, error);
		}
	}

	pause(): void {
		if (this.status !== 'listening') {
			return;
		}

		this.vadClient.pause();
		this.setStatus('idle');
		console.log('[STT] Paused speech recognition');
	}

	destroy(): void {
		this.vadClient.destroy();
		this.whisperClient.dispose();
		this.isInitialized = false;
		this.setStatus('idle');
		console.log('[STT] Speech-to-Text system destroyed');
	}

	getStatus(): STTStatus {
		return this.status;
	}

	getConfig(): STTConfig {
		return {
			vad: { ...this.config.vad },
			whisper: { ...this.config.whisper },
			autoStart: this.config.autoStart,
			circuitBreaker: this.config.circuitBreaker,
			retry: this.config.retry
		};
	}

	getResilienceState() {
		return {
			system: {
				circuitBreaker: this.resilientOps.getCircuitBreakerState(),
				retryConfig: this.resilientOps.getRetryConfig(),
				recoveryAttempts: this.recoveryAttempts
			},
			whisper: this.whisperClient.getResilienceState()
		};
	}

	resetCircuitBreakers(): void {
		console.log('[STT] Resetting all circuit breakers');
		this.resilientOps.resetCircuitBreaker();
		this.whisperClient.resetCircuitBreaker();
		this.recoveryAttempts = 0;
	}

	updateConfig(newConfig: Partial<STTConfig>): void {
		this.config = {
			...this.config,
			...newConfig,
			vad: { ...this.config.vad, ...newConfig.vad },
			whisper: { ...this.config.whisper, ...newConfig.whisper }
		};

		// Update individual clients
		if (newConfig.vad) {
			this.vadClient.updateConfig(newConfig.vad);
		}

		if (newConfig.whisper) {
			this.whisperClient.updateConfig(newConfig.whisper);
		}

		// Reinitialize if needed
		if (
			(newConfig.vad && Object.keys(newConfig.vad).length > 0) ||
			(newConfig.whisper && Object.keys(newConfig.whisper).length > 0)
		) {
			this.isInitialized = false;
		}
	}

	updateCallbacks(newCallbacks: Partial<STTCallbacks>): void {
		this.callbacks = { ...this.callbacks, ...newCallbacks };
	}

	static getProviderInfo(): {
		vad: { name: string; description: string };
		whisper: {
			name: string;
			description: string;
			models: Array<{ id: string; name: string; size: string }>;
		};
	} {
		return {
			vad: {
				name: 'Silero VAD',
				description: 'Voice Activity Detection using Silero models'
			},
			whisper: {
				name: 'Whisper ASR',
				description: 'Automatic Speech Recognition using OpenAI Whisper via Transformers.js',
				models: WhisperClient.getAvailableModels()
			}
		};
	}

	static async testMicrophoneAccess(): Promise<{ success: boolean; message: string }> {
		return VADClient.testMicrophoneAccess();
	}

	static async testConnection(config?: Partial<STTConfig>): Promise<{
		success: boolean;
		message: string;
		details: {
			vad: { success: boolean; message: string };
			whisper: { success: boolean; message: string };
		};
	}> {
		try {
			console.log('[STT] Testing Speech-to-Text system...');

			// Test microphone access
			const micTest = await this.testMicrophoneAccess();

			// Test Whisper
			const whisperTest = await WhisperClient.testConnection(config?.whisper);

			const allSuccessful = micTest.success && whisperTest.success;

			return {
				success: allSuccessful,
				message: allSuccessful
					? 'Speech-to-Text system test successful'
					: 'Some Speech-to-Text components failed testing',
				details: {
					vad: micTest,
					whisper: whisperTest
				}
			};
		} catch (error) {
			return {
				success: false,
				message: `Speech-to-Text test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				details: {
					vad: { success: false, message: 'Test not completed' },
					whisper: { success: false, message: 'Test not completed' }
				}
			};
		}
	}
}
