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
		this.config = {
			voice: (config?.voice || env.KOKORO_VOICE || 'af_bella') as KokoroVoice,
			modelId: config?.modelId || env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX',
			dtype: (config?.dtype || env.KOKORO_DTYPE || 'q4') as KokoroTTSConfig['dtype'],
			device: (config?.device || env.KOKORO_DEVICE || 'wasm') as KokoroTTSConfig['device']
		};
	}

	private async initialize(): Promise<void> {
		if (this.isInitialized && this.tts) {
			return;
		}

		try {
			console.log(
				`[KokoroTTS] Initializing with model: ${this.config.modelId}, dtype: ${this.config.dtype}, device: ${this.config.device}`
			);

			this.tts = await KokoroTTS.from_pretrained(this.config.modelId, {
				dtype: this.config.dtype,
				device: this.config.device
			});

			this.isInitialized = true;
			console.log('[KokoroTTS] Initialization complete');
		} catch (error) {
			console.error('[KokoroTTS] Failed to initialize:', error);
			throw new Error(
				`Failed to initialize Kokoro TTS: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	async synthesize(text: string, voice?: KokoroVoice): Promise<TTSResponse> {
		await this.initialize();

		if (!this.tts) {
			throw new Error('Kokoro TTS not initialized');
		}

		const selectedVoice = voice || this.config.voice;

		try {
			console.log(`[KokoroTTS] Synthesizing text with voice: ${selectedVoice}`);
			console.log(`[KokoroTTS] Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

			const audio = await this.tts.generate(text, {
				voice: selectedVoice as keyof typeof this.tts.voices
			});

			// RawAudio from transformers.js
			const audioData = (audio as { data: Float32Array }).data || (audio as Float32Array);
			const sampleRate =
				(audio as { sampling_rate?: number; sample_rate?: number }).sampling_rate ||
				(audio as { sampling_rate?: number; sample_rate?: number }).sample_rate ||
				22050;

			// Convert Float32Array to ArrayBuffer (PCM format)
			const audioBuffer = new ArrayBuffer(audioData.byteLength);
			const view = new Uint8Array(audioBuffer);
			const sourceView = new Uint8Array(
				audioData.buffer,
				audioData.byteOffset,
				audioData.byteLength
			);
			view.set(sourceView);

			const response: TTSResponse = {
				audio: audioBuffer,
				sampleRate,
				duration: audioData.length / sampleRate
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
