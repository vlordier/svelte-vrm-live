import { KokoroTTSClient, type KokoroVoice, type TTSResponse } from './kokoro';
import { env } from '$env/dynamic/private';

export type TTSProvider = 'kokoro' | 'browser';

export interface TTSConfig {
	provider: TTSProvider;
	voice: string;
	rate?: number;
	pitch?: number;
	volume?: number;
}

export interface BrowserTTSConfig extends TTSConfig {
	provider: 'browser';
	voice: string; // Browser voice name
}

export interface KokoroTTSConfig extends TTSConfig {
	provider: 'kokoro';
	voice: KokoroVoice;
	modelId?: string;
	dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';
	device?: 'wasm' | 'webgpu' | 'cpu';
}

export class UnifiedTTSClient {
	private config: TTSConfig;
	private kokoroClient?: KokoroTTSClient;

	constructor(config?: Partial<TTSConfig>) {
		const provider = (config?.provider || env.TTS_PROVIDER || this.detectProvider()) as TTSProvider;

		this.validateProvider(provider);

		this.config = {
			provider,
			voice: this.getDefaultVoice(provider, config?.voice),
			rate: config?.rate || 1.0,
			pitch: config?.pitch || 1.0,
			volume: config?.volume || 1.0
		};

		this.initializeClient();
	}

	private detectProvider(): TTSProvider {
		// Check for Kokoro configuration
		if (env.TTS_PROVIDER === 'kokoro' || env.KOKORO_MODEL_ID) {
			return 'kokoro';
		}

		// Default to kokoro for local TTS (as requested by user)
		return 'kokoro';
	}

	private validateProvider(provider: string): asserts provider is TTSProvider {
		const validProviders: TTSProvider[] = ['kokoro', 'browser'];
		if (!validProviders.includes(provider as TTSProvider)) {
			throw new Error(
				`Invalid TTS_PROVIDER: "${provider}". Must be one of: ${validProviders.join(', ')}`
			);
		}
	}

	private getDefaultVoice(provider: TTSProvider, customVoice?: string): string {
		if (customVoice) return customVoice;

		switch (provider) {
			case 'kokoro':
				return env.KOKORO_VOICE || 'af_bella';
			case 'browser':
				return 'default';
			default:
				throw new Error(`Unsupported TTS provider: ${provider}`);
		}
	}

	private initializeClient(): void {
		switch (this.config.provider) {
			case 'kokoro':
				this.kokoroClient = new KokoroTTSClient({
					voice: this.config.voice as KokoroVoice,
					modelId: env.KOKORO_MODEL_ID,
					dtype: env.KOKORO_DTYPE as KokoroTTSConfig['dtype'],
					device: env.KOKORO_DEVICE as KokoroTTSConfig['device']
				});
				break;
			case 'browser':
				// Browser TTS doesn't need initialization
				break;
			default:
				throw new Error(`Unsupported TTS provider: ${this.config.provider}`);
		}
	}

	async synthesize(text: string): Promise<TTSResponse> {
		switch (this.config.provider) {
			case 'kokoro':
				return this.synthesizeKokoro(text);
			case 'browser':
				return this.synthesizeBrowser(text);
			default:
				throw new Error(`Unsupported TTS provider: ${this.config.provider}`);
		}
	}

	private async synthesizeKokoro(text: string): Promise<TTSResponse> {
		if (!this.kokoroClient) {
			throw new Error('Kokoro TTS client not initialized');
		}

		return this.kokoroClient.synthesize(text, this.config.voice as KokoroVoice);
	}

	private async synthesizeBrowser(text: string): Promise<TTSResponse> {
		return new Promise((resolve, reject) => {
			if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
				reject(new Error('Browser TTS not supported'));
				return;
			}

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.voice =
				window.speechSynthesis.getVoices().find((v) => v.name === this.config.voice) || null;
			utterance.rate = this.config.rate || 1.0;
			utterance.pitch = this.config.pitch || 1.0;
			utterance.volume = this.config.volume || 1.0;

			// Browser TTS doesn't provide direct audio buffer access
			// This is a simplified implementation
			utterance.onend = () => {
				resolve({
					audio: new ArrayBuffer(0), // Browser TTS plays directly
					sampleRate: 22050,
					duration: text.length * 0.1 // Rough estimate
				});
			};

			utterance.onerror = (event) => {
				reject(new Error(`Browser TTS error: ${event.error}`));
			};

			window.speechSynthesis.speak(utterance);
		});
	}

	getConfig(): TTSConfig {
		return { ...this.config };
	}

	updateConfig(newConfig: Partial<TTSConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// Reinitialize if provider changed
		if (newConfig.provider && newConfig.provider !== this.config.provider) {
			this.initializeClient();
		}

		// Update kokoro client if needed
		if (this.kokoroClient && this.config.provider === 'kokoro') {
			this.kokoroClient.updateConfig({
				voice: this.config.voice as KokoroVoice
			});
		}
	}

	async dispose(): Promise<void> {
		if (this.kokoroClient) {
			await this.kokoroClient.dispose();
			this.kokoroClient = undefined;
		}
	}

	static getProviderInfo(): Record<
		TTSProvider,
		{ name: string; description: string; isLocal: boolean; voices: string[] }
	> {
		return {
			kokoro: {
				name: 'Kokoro TTS',
				description: 'High-quality local TTS with ONNX runtime',
				isLocal: true,
				voices: KokoroTTSClient.getAvailableVoices()
			},
			browser: {
				name: 'Browser TTS',
				description: 'Native browser speech synthesis',
				isLocal: true,
				voices: ['default'] // Browser voices are dynamic
			}
		};
	}

	static async testConnection(
		provider?: TTSProvider
	): Promise<{ success: boolean; message: string }> {
		const testProvider = provider || 'kokoro';

		try {
			const client = new UnifiedTTSClient({ provider: testProvider });
			await client.synthesize('Hello, this is a test.');
			await client.dispose();

			return {
				success: true,
				message: `${testProvider} TTS connection successful`
			};
		} catch (error) {
			return {
				success: false,
				message: `${testProvider} TTS connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	static detectAvailableProvider(): { provider: TTSProvider; reason: string } {
		// Check for Kokoro configuration
		if (env.TTS_PROVIDER === 'kokoro' || env.KOKORO_MODEL_ID) {
			return { provider: 'kokoro', reason: 'Kokoro TTS configured' };
		}

		// Default to Kokoro as requested
		return { provider: 'kokoro', reason: 'Default (local TTS preferred)' };
	}
}
