import { pipeline, type Pipeline } from '@huggingface/transformers';

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

	constructor(config?: Partial<WhisperConfig>) {
		const modelId = config?.modelId || 'Xenova/whisper-tiny.en';
		const isEnglishOnly = modelId.includes('.en');

		this.config = {
			modelId,
			dtype: config?.dtype || 'q4',
			device: config?.device || 'wasm',
			returnTimestamps: config?.returnTimestamps || false,
			chunkLength: config?.chunkLength || 30,
			strideLengthLeft: config?.strideLengthLeft || 5,
			strideLengthRight: config?.strideLengthRight || 5
		} as WhisperConfig;

		// Only add language and task for multilingual models
		if (!isEnglishOnly) {
			this.config.language = config?.language || 'en';
			this.config.task = config?.task || 'transcribe';
		}

		console.log(
			`[Whisper] Using ${isEnglishOnly ? 'English-only' : 'multilingual'} model: ${modelId}`
		);
		if (isEnglishOnly) {
			console.log('[Whisper] English-only model detected - excluding language/task parameters');
		}
	}

	private async initialize(): Promise<void> {
		if (this.isInitialized && this.transcriber) {
			return;
		}

		try {
			console.log(`[Whisper] Initializing ASR with model: ${this.config.modelId}`);
			console.log(`[Whisper] Config: dtype=${this.config.dtype}, device=${this.config.device}`);

			this.transcriber = (await pipeline('automatic-speech-recognition', this.config.modelId, {
				dtype: this.config.dtype as any,
				device: this.config.device
			})) as any;

			this.isInitialized = true;
			console.log('[Whisper] Automatic Speech Recognition initialized successfully');
		} catch (error) {
			console.error('[Whisper] Failed to initialize:', error);
			throw new Error(
				`Failed to initialize Whisper ASR: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	async transcribe(audio: Float32Array): Promise<TranscriptionResult> {
		await this.initialize();

		if (!this.transcriber) {
			throw new Error('Whisper transcriber not initialized');
		}

		try {
			console.log(`[Whisper] Transcribing audio: ${audio.length} samples`);

			const startTime = performance.now();

			// Build transcription options - only include language/task if they exist
			const transcribeOptions: any = {
				return_timestamps: this.config.returnTimestamps,
				chunk_length_s: this.config.chunkLength,
				stride_length_s: [this.config.strideLengthLeft, this.config.strideLengthRight]
			};

			// Only add language and task for multilingual models
			if (this.config.language !== undefined) {
				transcribeOptions.language = this.config.language;
			}
			if (this.config.task !== undefined) {
				transcribeOptions.task = this.config.task;
			}

			console.log(`[Whisper] Transcription options:`, transcribeOptions);

			const result = await this.transcriber(audio, transcribeOptions);

			const endTime = performance.now();
			const processingTime = (endTime - startTime) / 1000;

			console.log(`[Whisper] Transcription complete in ${processingTime.toFixed(2)}s`);
			console.log(`[Whisper] Result: "${result.text}"`);

			// Handle different result formats from transformers.js
			const transcriptionResult: TranscriptionResult = {
				text: result.text || '',
				chunks: result.chunks || undefined,
				confidence: result.confidence || undefined
			};

			// Only add language if it was configured (for multilingual models)
			if (this.config.language !== undefined) {
				transcriptionResult.language = this.config.language;
			}

			return transcriptionResult;
		} catch (error) {
			console.error('[Whisper] Transcription failed:', error);
			throw new Error(
				`Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	getConfig(): WhisperConfig {
		return { ...this.config };
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
			try {
				// Explicit cleanup for transformers.js pipeline
				// This helps prevent memory leaks, especially with WebGL/WebGPU contexts
				if (typeof this.transcriber.dispose === 'function') {
					await this.transcriber.dispose();
				}
				// Clear the reference
				this.transcriber = null;
				console.log('[Whisper] Transcriber pipeline disposed successfully');
			} catch (error) {
				console.warn('[Whisper] Warning during transcriber disposal:', error);
				this.transcriber = null;
			}
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
