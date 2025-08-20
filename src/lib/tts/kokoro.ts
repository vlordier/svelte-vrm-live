import { KokoroTTS } from 'kokoro-js';
import { env } from '$env/dynamic/private';

export type KokoroVoice =
	| 'af_heart'
	| 'af_alloy'
	| 'af_aoede'
	| 'af_bella'
	| 'af_jessica'
	| 'af_kore'
	| 'af_nicole'
	| 'af_nova'
	| 'af_river'
	| 'af_sarah'
	| 'af_sky'
	| 'am_adam'
	| 'am_echo'
	| 'am_eric'
	| 'am_fenrir'
	| 'am_liam'
	| 'am_michael'
	| 'am_onyx'
	| 'am_puck'
	| 'am_santa'
	| 'bf_emma'
	| 'bf_isabella'
	| 'bf_alice'
	| 'bf_lily'
	| 'bm_george'
	| 'bm_lewis'
	| 'bm_daniel'
	| 'bm_fable';

export interface KokoroTTSConfig {
	voice: KokoroVoice;
	modelId: string;
	dtype: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';
	device: 'wasm' | 'webgpu' | 'cpu';
}

export interface TTSResponse {
	audio: ArrayBuffer;
	sampleRate: number;
	duration: number;
}

export class KokoroTTSClient {
	private tts: KokoroTTS | null = null;
	private config: KokoroTTSConfig;
	private isInitialized = false;

	constructor(config?: Partial<KokoroTTSConfig>) {
		// Auto-detect device based on environment
		const defaultDevice = this.detectBestDevice(config?.device || env.KOKORO_DEVICE);

		this.config = {
			voice: (config?.voice || env.KOKORO_VOICE || 'af_bella') as KokoroVoice,
			modelId: config?.modelId || env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX',
			dtype: this.selectBestDtype(config?.dtype || env.KOKORO_DTYPE, defaultDevice),
			device: defaultDevice
		};

		console.log(
			`[KokoroTTS] Configuration: device=${this.config.device}, dtype=${this.config.dtype}, voice=${this.config.voice}`
		);
	}

	private detectBestDevice(preferredDevice?: string): KokoroTTSConfig['device'] {
		// In server-side environment, only CPU is supported
		if (typeof window === 'undefined') {
			console.log('[KokoroTTS] Server environment detected, using CPU device');
			return 'cpu';
		}

		// In browser, prefer wasm if available, fallback to cpu
		if (preferredDevice === 'webgpu' || preferredDevice === 'wasm' || preferredDevice === 'cpu') {
			return preferredDevice as KokoroTTSConfig['device'];
		}

		// Default browser device
		return 'wasm';
	}

	private selectBestDtype(
		preferredDtype?: string,
		device?: KokoroTTSConfig['device']
	): KokoroTTSConfig['dtype'] {
		// For CPU device, use fp32 for better stability
		if (device === 'cpu') {
			console.log('[KokoroTTS] Using fp32 dtype for CPU device to avoid corruption issues');
			return 'fp32';
		}

		// For other devices, respect preference or default to q4
		if (
			preferredDtype === 'fp32' ||
			preferredDtype === 'fp16' ||
			preferredDtype === 'q8' ||
			preferredDtype === 'q4' ||
			preferredDtype === 'q4f16'
		) {
			return preferredDtype as KokoroTTSConfig['dtype'];
		}

		return 'q4';
	}

	private async initialize(): Promise<void> {
		if (this.isInitialized && this.tts) {
			return;
		}

		try {
			console.log(
				`[KokoroTTS] Initializing with model: ${this.config.modelId}, dtype: ${this.config.dtype}, device: ${this.config.device}`
			);

			// Add progress logging for model download
			const startTime = Date.now();
			console.log('[KokoroTTS] Starting model download/initialization...');

			this.tts = await KokoroTTS.from_pretrained(this.config.modelId, {
				dtype: this.config.dtype,
				device: this.config.device,
				progress_callback: (progress: any) => {
					const percentage = Math.round((progress.loaded / progress.total) * 100);
					const fileName = progress.file || 'model files';
					if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
						console.log(`[KokoroTTS] Downloading ${fileName}: ${percentage}%`);
					}
				}
			});

			const duration = Date.now() - startTime;
			this.isInitialized = true;
			console.log(`[KokoroTTS] Initialization complete in ${duration}ms`);
		} catch (error) {
			console.error('[KokoroTTS] Failed to initialize:', error);

			// Check if it's a network/download error
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			if (
				errorMessage.includes('fetch') ||
				errorMessage.includes('network') ||
				errorMessage.includes('download')
			) {
				throw new Error(
					`Failed to download Kokoro TTS model. Please check your internet connection. ${errorMessage}`
				);
			}

			throw new Error(`Failed to initialize Kokoro TTS: ${errorMessage}`);
		}
	}

	async synthesize(text: string, voice?: KokoroVoice): Promise<TTSResponse> {
		await this.initialize();

		if (!this.tts) {
			throw new Error('Kokoro TTS not initialized');
		}

		const selectedVoice = voice || this.config.voice;

		// Validate voice exists
		const availableVoices = KokoroTTSClient.getAvailableVoices();
		if (!availableVoices.includes(selectedVoice as KokoroVoice)) {
			console.warn(`[KokoroTTS] Voice '${selectedVoice}' not available, using 'af_bella'`);
		}

		try {
			console.log(`[KokoroTTS] Synthesizing text with voice: ${selectedVoice}`);
			console.log(`[KokoroTTS] Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
			console.log(
				`[KokoroTTS] Available voices in model:`,
				this.tts?.voices ? Object.keys(this.tts.voices) : 'N/A'
			);

			const audio = await this.tts.generate(text, {
				voice: selectedVoice as keyof typeof this.tts.voices
			});

			console.log(`[KokoroTTS] Generated audio object:`, typeof audio, audio?.constructor?.name);

			// Handle RawAudio object from transformers.js/kokoro-js
			let audioData: Float32Array;
			let sampleRate: number;

			if (audio && typeof audio === 'object') {
				// Try different property names for RawAudio
				const audioObj = audio as unknown as Record<string, unknown>;
				audioData =
					(audioObj.data as Float32Array) ||
					(audioObj.audio as Float32Array) ||
					(audioObj.samples as Float32Array) ||
					(audio as unknown as Float32Array);
				sampleRate =
					(audioObj.sampling_rate as number) ||
					(audioObj.sample_rate as number) ||
					(audioObj.sampleRate as number) ||
					24000;

				console.log(`[KokoroTTS] Raw audio properties:`, Object.keys(audio));
				console.log(
					`[KokoroTTS] Audio data found:`,
					typeof audioData,
					audioData?.length,
					audioData?.constructor?.name
				);
				console.log(`[KokoroTTS] Sample rate found: ${sampleRate}`);

				// If audioData is still undefined, try to access the audio directly
				if (!audioData) {
					// Maybe the audio IS the Float32Array directly
					if (audio instanceof Float32Array) {
						audioData = audio;
					} else {
						// Log all properties to understand the structure
						console.error(`[KokoroTTS] Could not find audio data in RawAudio object:`, audio);
						throw new Error('No audio data found in RawAudio object');
					}
				}
			} else {
				throw new Error(`Unexpected audio response type: ${typeof audio}`);
			}

			if (!audioData || audioData.length === 0) {
				throw new Error('No audio data generated - empty result from Kokoro TTS');
			}

			// Convert Float32Array to ArrayBuffer (PCM format)
			let audioBuffer: ArrayBuffer;

			if (audioData instanceof Float32Array) {
				// Create a copy of the audio data's underlying ArrayBuffer.
				audioBuffer = (audioData.buffer as ArrayBuffer).slice(
					audioData.byteOffset,
					audioData.byteOffset + audioData.byteLength
				);
			} else {
				throw new Error(
					`Audio data is not Float32Array: ${typeof audioData}, constructor: ${(audioData as any)?.constructor?.name}`
				);
			}

			// Calculate duration properly (audioData.length is number of samples)
			const durationSeconds = audioData.length / sampleRate;
			const validDuration = isNaN(durationSeconds) ? 0 : durationSeconds;

			const response: TTSResponse = {
				audio: audioBuffer,
				sampleRate,
				duration: validDuration
			};

			console.log(
				`[KokoroTTS] Synthesis complete. Duration: ${response.duration.toFixed(2)}s, Sample Rate: ${sampleRate}Hz`
			);
			return response;
		} catch (error) {
			console.error('[KokoroTTS] Synthesis failed:', error);
			throw new Error(
				`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	getConfig(): KokoroTTSConfig {
		return { ...this.config };
	}

	updateConfig(newConfig: Partial<KokoroTTSConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// If device or model changes, reinitialize
		if (newConfig.device || newConfig.modelId || newConfig.dtype) {
			this.isInitialized = false;
			this.tts = null;
		}
	}

	async dispose(): Promise<void> {
		if (this.tts) {
			// Kokoro TTS cleanup if available
			this.tts = null;
		}
		this.isInitialized = false;
	}

	static getAvailableVoices(): KokoroVoice[] {
		return [
			'af_heart',
			'af_alloy',
			'af_aoede',
			'af_bella',
			'af_jessica',
			'af_kore',
			'af_nicole',
			'af_nova',
			'af_river',
			'af_sarah',
			'af_sky',
			'am_adam',
			'am_echo',
			'am_eric',
			'am_fenrir',
			'am_liam',
			'am_michael',
			'am_onyx',
			'am_puck',
			'am_santa',
			'bf_emma',
			'bf_isabella',
			'bf_alice',
			'bf_lily',
			'bm_george',
			'bm_lewis',
			'bm_daniel',
			'bm_fable'
		];
	}

	static async testConnection(
		config?: Partial<KokoroTTSConfig>
	): Promise<{ success: boolean; message: string }> {
		try {
			const client = new KokoroTTSClient(config);
			await client.synthesize('Hello, this is a test.');
			await client.dispose();

			return {
				success: true,
				message: 'Kokoro TTS connection successful'
			};
		} catch (error) {
			return {
				success: false,
				message: `Kokoro TTS connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}
}
