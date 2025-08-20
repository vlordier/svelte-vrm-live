import { VADClient, type VADConfig, type VADCallbacks } from './vad';
import { WhisperClient, type WhisperConfig, type TranscriptionResult } from './whisper';
import { env } from '$env/dynamic/public';

export interface STTConfig {
	vad: VADConfig;
	whisper: WhisperConfig;
	autoStart?: boolean;
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

	constructor(config?: Partial<STTConfig>, callbacks: STTCallbacks = {}) {
		this.config = {
			vad: {
				startOnLoad: false,
				positiveSpeechThreshold: Number(env.PUBLIC_VAD_POSITIVE_THRESHOLD) || 0.8,
				negativeSpeechThreshold: Number(env.PUBLIC_VAD_NEGATIVE_THRESHOLD) || 0.35,
				minSpeechFrames: Number(env.PUBLIC_VAD_MIN_SPEECH_FRAMES) || 5,
				...config?.vad
			},
			whisper: {
				modelId: env.PUBLIC_WHISPER_MODEL_ID || 'Xenova/whisper-tiny.en',
				dtype: (env.PUBLIC_WHISPER_DTYPE as WhisperConfig['dtype']) || 'q4',
				device: (env.PUBLIC_WHISPER_DEVICE as WhisperConfig['device']) || 'wasm',
				returnTimestamps: config?.whisper?.returnTimestamps || false,
				language: env.PUBLIC_WHISPER_LANGUAGE || 'en',
				task: (env.PUBLIC_WHISPER_TASK as WhisperConfig['task']) || 'transcribe',
				...config?.whisper
			},
			autoStart: config?.autoStart ?? false
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

		this.vadClient = new VADClient(this.config.vad, vadCallbacks);
		this.whisperClient = new WhisperClient(this.config.whisper);
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

		try {
			await this.vadClient.start();
			this.setStatus('listening');
			console.log('[STT] Started listening for speech');
		} catch (error) {
			console.error('[STT] Failed to start:', error);
			this.setStatus('error');
			const errorObj = error instanceof Error ? error : new Error('Unknown start error');
			this.callbacks.onError?.(errorObj);
			throw errorObj;
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
			autoStart: this.config.autoStart
		};
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
}
