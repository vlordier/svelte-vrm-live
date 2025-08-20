import { MicVAD } from '@ricky0123/vad-web';

export interface VADConfig {
	readonly positiveSpeechThreshold?: number;
	readonly negativeSpeechThreshold?: number;
	readonly preSpeechPadFrames?: number;
	readonly redemptionFrames?: number;
	readonly frameSamples?: number;
	readonly minSpeechFrames?: number;
	readonly startOnLoad?: boolean;
	readonly submitUserSpeechOnPause?: boolean;
}

export interface VADState {
	readonly isInitialized: boolean;
	readonly isListening: boolean;
	readonly lastError?: Error;
}

export interface VADCallbacks {
	readonly onSpeechStart?: (audio: Float32Array) => void;
	readonly onSpeechEnd?: (audio: Float32Array) => void;
	readonly onVADMisfire?: (audio: Float32Array) => void;
	readonly onFrameProcessed?: (probabilities: {
		readonly isSpeech: number;
		readonly notSpeech: number;
	}) => void;
	readonly onError?: (error: Error) => void;
}

export class VADClient {
	private vad: Awaited<ReturnType<typeof MicVAD.new>> | null = null;
	private config: Required<VADConfig>;
	private callbacks: VADCallbacks;
	private isInitialized = false;
	private lastError?: Error;

	constructor(config: VADConfig = {}, callbacks: VADCallbacks = {}) {
		this.config = {
			positiveSpeechThreshold: config.positiveSpeechThreshold ?? 0.8,
			negativeSpeechThreshold: config.negativeSpeechThreshold ?? 0.35,
			preSpeechPadFrames: config.preSpeechPadFrames ?? 1,
			redemptionFrames: config.redemptionFrames ?? 8,
			frameSamples: config.frameSamples ?? 1536,
			minSpeechFrames: config.minSpeechFrames ?? 5,
			startOnLoad: config.startOnLoad ?? false,
			submitUserSpeechOnPause: config.submitUserSpeechOnPause ?? true
		};

		this.callbacks = { ...callbacks };
		this.validateConfig();
	}

	private validateConfig(): void {
		const { positiveSpeechThreshold, negativeSpeechThreshold, minSpeechFrames } = this.config;

		if (positiveSpeechThreshold < 0 || positiveSpeechThreshold > 1) {
			throw new Error(
				`Invalid positiveSpeechThreshold: ${positiveSpeechThreshold}. Must be between 0 and 1`
			);
		}

		if (negativeSpeechThreshold < 0 || negativeSpeechThreshold > 1) {
			throw new Error(
				`Invalid negativeSpeechThreshold: ${negativeSpeechThreshold}. Must be between 0 and 1`
			);
		}

		if (positiveSpeechThreshold <= negativeSpeechThreshold) {
			throw new Error(
				`positiveSpeechThreshold (${positiveSpeechThreshold}) must be greater than negativeSpeechThreshold (${negativeSpeechThreshold})`
			);
		}

		if (minSpeechFrames < 1) {
			throw new Error(`Invalid minSpeechFrames: ${minSpeechFrames}. Must be at least 1`);
		}
	}

	async initialize(): Promise<void> {
		if (this.isInitialized && this.vad) {
			console.log('[VAD] Already initialized, skipping...');
			return;
		}

		try {
			console.log('[VAD] Initializing Voice Activity Detection...', {
				config: this.config,
				timestamp: new Date().toISOString()
			});

			// Clear any previous error
			this.lastError = undefined;

			this.vad = await MicVAD.new({
				...this.config,
				onSpeechStart: (audio: Float32Array) => {
					console.log('[VAD] Speech started', {
						audioLength: audio.length,
						timestamp: new Date().toISOString()
					});
					try {
						this.callbacks.onSpeechStart?.(audio);
					} catch (error) {
						const callbackError = new Error(
							`Speech start callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
						console.error('[VAD] Speech start callback error:', callbackError);
						this.lastError = callbackError;
						this.callbacks.onError?.(callbackError);
					}
				},
				onSpeechEnd: (audio: Float32Array) => {
					console.log('[VAD] Speech ended', {
						audioLength: audio.length,
						duration: (audio.length / 16000).toFixed(2) + 's',
						timestamp: new Date().toISOString()
					});
					try {
						this.callbacks.onSpeechEnd?.(audio);
					} catch (error) {
						const callbackError = new Error(
							`Speech end callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
						console.error('[VAD] Speech end callback error:', callbackError);
						this.lastError = callbackError;
						this.callbacks.onError?.(callbackError);
					}
				},
				onVADMisfire: (audio: Float32Array) => {
					console.warn('[VAD] VAD misfire detected', {
						audioLength: audio.length,
						timestamp: new Date().toISOString()
					});
					try {
						this.callbacks.onVADMisfire?.(audio);
					} catch (error) {
						const callbackError = new Error(
							`VAD misfire callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
						console.error('[VAD] VAD misfire callback error:', callbackError);
						this.lastError = callbackError;
						this.callbacks.onError?.(callbackError);
					}
				},
				onFrameProcessed: (probabilities: { isSpeech: number; notSpeech: number }) => {
					try {
						this.callbacks.onFrameProcessed?.(probabilities);
					} catch (error) {
						const callbackError = new Error(
							`Frame processed callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
						console.error('[VAD] Frame processed callback error:', callbackError);
						this.lastError = callbackError;
						this.callbacks.onError?.(callbackError);
					}
				}
			} as any);

			this.isInitialized = true;
			console.log('[VAD] Voice Activity Detection initialized successfully', {
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			const initError = new Error(
				`Failed to initialize VAD: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			console.error('[VAD] Initialization failed:', initError, {
				originalError: error,
				config: this.config,
				timestamp: new Date().toISOString()
			});
			this.lastError = initError;
			this.callbacks.onError?.(initError);
			throw initError;
		}
	}

	async start(): Promise<void> {
		await this.initialize();

		if (!this.vad) {
			throw new Error('VAD not initialized');
		}

		try {
			this.vad.start();
			console.log('[VAD] Started listening for speech');
		} catch (error) {
			console.error('[VAD] Failed to start:', error);
			throw new Error(
				`Failed to start VAD: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	pause(): void {
		if (this.vad) {
			this.vad.pause();
			console.log('[VAD] Paused listening');
		}
	}

	destroy(): void {
		if (this.vad) {
			this.vad.destroy();
			this.vad = null;
			this.isInitialized = false;
			console.log('[VAD] Voice Activity Detection destroyed');
		}
	}

	getConfig(): Required<VADConfig> {
		return { ...this.config };
	}

	getState(): VADState {
		return {
			isInitialized: this.isInitialized,
			isListening: this.isListening(),
			lastError: this.lastError
		};
	}

	updateConfig(newConfig: Partial<VADConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// VAD requires reinitialization for config changes
		if (this.isInitialized) {
			this.destroy();
			this.isInitialized = false;
		}
	}

	updateCallbacks(newCallbacks: Partial<VADCallbacks>): void {
		this.callbacks = { ...this.callbacks, ...newCallbacks };

		// VAD requires reinitialization for callback changes
		if (this.isInitialized) {
			this.destroy();
			this.isInitialized = false;
		}
	}

	isListening(): boolean {
		// Use the VAD's internal listening state for more accurate tracking
		// @ts-expect-error - accessing private property for accurate state detection
		return this.vad?.listening ?? false;
	}

	static async testMicrophoneAccess(): Promise<{ success: boolean; message: string }> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => track.stop());

			return {
				success: true,
				message: 'Microphone access granted'
			};
		} catch (error) {
			return {
				success: false,
				message: `Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}
}
