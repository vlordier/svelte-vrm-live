import { pipeline, type Pipeline } from '@huggingface/transformers';
import {
	ResilientOperationManager,
	type CircuitBreakerConfig,
	type RetryConfig
} from './resilience';

export interface WhisperConfig {
	modelId: string;
	dtype: 'fp32' | 'fp16' | 'q8' | 'q4' | 'int8';
	device: 'webgpu' | 'wasm' | 'cpu';
	returnTimestamps?: boolean | 'word' | 'char';
	chunkLength?: number;
	strideLengthLeft?: number;
	strideLengthRight?: number;
	language?: string;
	task?: 'transcribe' | 'translate';
	// Resilience configuration
	circuitBreaker?: Partial<CircuitBreakerConfig>;
	retry?: Partial<RetryConfig>;
}

export interface TranscriptionResult {
	text: string;
	chunks?: Array<{
		text: string;
		timestamp: [number, number | null];
	}>;
	language?: string;
	confidence?: number;
}

export class WhisperClient {
	private transcriber: Pipeline | null = null;
	private config: WhisperConfig;
	private isInitialized = false;
	private readonly resilientOps: ResilientOperationManager;

	constructor(config?: Partial<WhisperConfig>) {
		this.config = {
			modelId: config?.modelId || 'Xenova/whisper-tiny.en',
			dtype: config?.dtype || 'q4',
			device: config?.device || 'wasm',
			returnTimestamps: config?.returnTimestamps || false,
			chunkLength: config?.chunkLength || 30,
			strideLengthLeft: config?.strideLengthLeft || 5,
			strideLengthRight: config?.strideLengthRight || 5,
			language: config?.language || 'en',
			task: config?.task || 'transcribe',
			circuitBreaker: config?.circuitBreaker,
			retry: config?.retry
		};

		// Initialize resilient operations manager
		this.resilientOps = new ResilientOperationManager(
			this.config.circuitBreaker,
			this.config.retry
		);
	}

	private async initialize(): Promise<void> {
		if (this.isInitialized && this.transcriber) {
			console.log('[Whisper] Already initialized, skipping...');
			return;
		}

		// Use resilient operations for initialization
		await this.resilientOps.execute(
			async () => {
				console.log(`[Whisper] Initializing ASR with model: ${this.config.modelId}`, {
					config: {
						modelId: this.config.modelId,
						dtype: this.config.dtype,
						device: this.config.device
					},
					circuitState: this.resilientOps.getCircuitBreakerState(),
					timestamp: new Date().toISOString()
				});

				this.transcriber = await pipeline('automatic-speech-recognition', this.config.modelId, {
					dtype: this.config.dtype,
					device: this.config.device
				});

				this.isInitialized = true;
				console.log('[Whisper] Automatic Speech Recognition initialized successfully', {
					modelId: this.config.modelId,
					timestamp: new Date().toISOString()
				});
			},
			'Whisper-Initialization',
			(error) => {
				// Determine if initialization errors are retryable
				if (error instanceof Error) {
					const message = error.message.toLowerCase();
					// Retry on network/download issues, not on invalid config
					return (
						message.includes('network') ||
						message.includes('download') ||
						message.includes('fetch') ||
						message.includes('timeout') ||
						message.includes('connection')
					);
				}
				return false;
			}
		);
	}

	async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
		await this.initialize();

		if (!this.transcriber) {
			throw new Error('Whisper transcriber not initialized');
		}

		// Use resilient operations for transcription
		return this.resilientOps.execute(
			async () => {
				console.log(`[Whisper] Transcribing audio: ${audio.length} samples`, {
					duration: (audio.length / 16000).toFixed(2) + 's',
					config: {
						language: this.config.language,
						task: this.config.task,
						returnTimestamps: this.config.returnTimestamps
					},
					circuitState: this.resilientOps.getCircuitBreakerState(),
					timestamp: new Date().toISOString()
				});

				const startTime = performance.now();

				const result = await this.transcriber!(audio, {
					return_timestamps: this.config.returnTimestamps,
					chunk_length_s: this.config.chunkLength,
					stride_length_s: [this.config.strideLengthLeft, this.config.strideLengthRight],
					language: this.config.language,
					task: this.config.task
				});

				const endTime = performance.now();
				const processingTime = (endTime - startTime) / 1000;

				console.log(`[Whisper] Transcription complete`, {
					processingTime: processingTime.toFixed(2) + 's',
					resultLength: result.text?.length || 0,
					resultPreview: result.text
						? `"${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`
						: 'empty',
					timestamp: new Date().toISOString()
				});

				// Handle different result formats from transformers.js
				const transcriptionResult: TranscriptionResult = {
					text: result.text || '',
					chunks: result.chunks || undefined,
					language: this.config.language,
					confidence: result.confidence || undefined
				};

				return transcriptionResult;
			},
			'Whisper-Transcription',
			(error) => {
				// Determine if transcription errors are retryable
				if (error instanceof Error) {
					const message = error.message.toLowerCase();
					// Retry on memory/resource issues, not on invalid audio
					return (
						message.includes('memory') ||
						message.includes('resource') ||
						message.includes('timeout') ||
						message.includes('busy') ||
						message.includes('unavailable')
					);
				}
				return false;
			}
		);
	}

	getConfig(): WhisperConfig {
		return { ...this.config };
	}

	getResilienceState() {
		return {
			circuitBreaker: this.resilientOps.getCircuitBreakerState(),
			retryConfig: this.resilientOps.getRetryConfig()
		};
	}

	resetCircuitBreaker(): void {
		console.log('[Whisper] Manual circuit breaker reset requested');
		this.resilientOps.resetCircuitBreaker();
	}

	updateConfig(newConfig: Partial<WhisperConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// If model, dtype, or device changes, reinitialize
		if (newConfig.modelId || newConfig.dtype || newConfig.device) {
			this.isInitialized = false;
			this.transcriber = null;
		}
	}

	async dispose(): Promise<void> {
		if (this.transcriber) {
			// Transformers.js pipeline cleanup
			this.transcriber = null;
		}
		this.isInitialized = false;
		console.log('[Whisper] Whisper ASR client disposed');
	}

	static getAvailableModels(): Array<{
		id: string;
		name: string;
		size: string;
		languages: string[];
	}> {
		return [
			{
				id: 'Xenova/whisper-tiny.en',
				name: 'Whisper Tiny English',
				size: '39 MB',
				languages: ['en']
			},
			{
				id: 'Xenova/whisper-tiny',
				name: 'Whisper Tiny Multilingual',
				size: '39 MB',
				languages: ['multilingual']
			},
			{
				id: 'Xenova/whisper-base.en',
				name: 'Whisper Base English',
				size: '74 MB',
				languages: ['en']
			},
			{
				id: 'Xenova/whisper-base',
				name: 'Whisper Base Multilingual',
				size: '74 MB',
				languages: ['multilingual']
			},
			{
				id: 'Xenova/whisper-small.en',
				name: 'Whisper Small English',
				size: '244 MB',
				languages: ['en']
			},
			{
				id: 'Xenova/whisper-small',
				name: 'Whisper Small Multilingual',
				size: '244 MB',
				languages: ['multilingual']
			}
		];
	}

	static async testConnection(
		config?: Partial<WhisperConfig>
	): Promise<{ success: boolean; message: string }> {
		try {
			const client = new WhisperClient(config);

			// Create a simple test audio (1 second of silence at 16kHz)
			const testAudio = new Float32Array(16000).fill(0);

			const result = await client.transcribe(testAudio);
			await client.dispose();

			return {
				success: true,
				message: `Whisper ASR connection successful. Test result: "${result.text}"`
			};
		} catch (error) {
			return {
				success: false,
				message: `Whisper ASR connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}
}
