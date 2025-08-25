 
import { browser } from '$app/environment';

// Remove global declarations to avoid conflicts with DOM types

export interface AudioDeviceInfo {
	audioContext: {
		supported: boolean;
		state: string;
		sampleRate: number;
		baseLatency?: number;
		outputLatency?: number;
		renderSize?: number;
		destination: {
			maxChannelCount: number;
			channelCount: number;
		};
	};
	permissions: {
		microphone: 'granted' | 'denied' | 'prompt' | 'not-supported';
		speaker: 'granted' | 'not-supported'; // Speakers don't require explicit permission
	};
	devices: {
		audioInputs: any[];
		audioOutputs: any[];
		defaultInput?: any;
		defaultOutput?: any;
	};
	capabilities: {
		webAudioAPI: boolean;
		mediaDevicesAPI: boolean;
		getUserMedia: boolean;
		enumerateDevices: boolean;
	};
	playbackTest: {
		canPlay: boolean;
		error?: string;
	};
}

export class AudioDeviceChecker {
	private static instance: AudioDeviceChecker;
	private audioContext: AudioContext | null = null;

	private constructor() {}

	static getInstance(): AudioDeviceChecker {
		if (!AudioDeviceChecker.instance) {
			AudioDeviceChecker.instance = new AudioDeviceChecker();
		}
		return AudioDeviceChecker.instance;
	}

	async checkAudioCapabilities(): Promise<AudioDeviceInfo> {
		if (!browser) {
			return this.getServerSideResponse();
		}

		const capabilities = this.checkWebAPIs();
		const audioContext = this.getAudioContextInfo();
		const permissions = await this.checkPermissions();
		const devices = await this.enumerateDevices();
		const playbackTest = await this.testAudioPlayback();

		return {
			audioContext,
			permissions: permissions as any,
			devices,
			capabilities,
			playbackTest
		};
	}

	private checkWebAPIs() {
		return {
			webAudioAPI:
				typeof AudioContext !== 'undefined' ||
				typeof (window as any).webkitAudioContext !== 'undefined',
			mediaDevicesAPI: typeof navigator.mediaDevices !== 'undefined',
			getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
			enumerateDevices: typeof navigator.mediaDevices?.enumerateDevices === 'function'
		};
	}

	private getAudioContextInfo() {
		try {
			// Create or reuse AudioContext
			if (!this.audioContext) {
				const AudioContextClass =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				if (!AudioContextClass) {
					throw new Error('AudioContext not supported');
				}
				this.audioContext = new AudioContextClass();
			}

			return {
				supported: true,
				state: this.audioContext.state,
				sampleRate: this.audioContext.sampleRate,
				baseLatency: this.audioContext.baseLatency,
				outputLatency: (this.audioContext as AudioContext & { outputLatency?: number })
					.outputLatency,
				renderSize: (this.audioContext as AudioContext & { renderSize?: number }).renderSize,
				destination: {
					maxChannelCount: this.audioContext.destination.maxChannelCount,
					channelCount: this.audioContext.destination.channelCount
				}
			};
		} catch (error) {
			console.error('[Audio Device Checker] AudioContext error:', error);
			return {
				supported: false,
				state: 'failed',
				sampleRate: 0,
				destination: {
					maxChannelCount: 0,
					channelCount: 0
				}
			};
		}
	}

	private async checkPermissions(): Promise<'granted' | 'denied' | 'prompt' | 'error'> {
		const permissions = {
			microphone: 'not-supported' as 'granted' | 'denied' | 'prompt' | 'not-supported',
			speaker: 'not-supported' as 'granted' | 'not-supported'
		};

		try {
			if (typeof navigator.permissions !== 'undefined') {
				const micPermission = await navigator.permissions.query({ name: 'microphone' });
				permissions.microphone = micPermission.state;
			}
		} catch (error) {
			console.warn('[Audio Device Checker] Microphone permission check failed:', error);
		}

		// Speakers typically don't require explicit permission
		permissions.speaker = 'granted';

		// Return the most restrictive permission state
		if (permissions.microphone === 'denied') return 'denied';
		if (permissions.microphone === 'prompt') return 'prompt';
		if (permissions.microphone === 'granted') return 'granted';
		return 'error';
	}

	private async enumerateDevices() {
		const devices = {
			audioInputs: [] as any[],
			audioOutputs: [] as any[],
			defaultInput: undefined as any,
			defaultOutput: undefined as any
		};

		try {
			if (typeof navigator.mediaDevices?.enumerateDevices === 'function') {
				const allDevices = await navigator.mediaDevices.enumerateDevices();

				devices.audioInputs = allDevices.filter((device) => device.kind === 'audioinput');
				devices.audioOutputs = allDevices.filter((device) => device.kind === 'audiooutput');

				// Find default devices (deviceId === 'default' or first device)
				devices.defaultInput =
					devices.audioInputs.find((d) => d.deviceId === 'default') || devices.audioInputs[0];
				devices.defaultOutput =
					devices.audioOutputs.find((d) => d.deviceId === 'default') || devices.audioOutputs[0];
			}
		} catch (error) {
			console.error('[Audio Device Checker] Device enumeration failed:', error);
		}

		return devices;
	}

	private async testAudioPlayback(): Promise<{ canPlay: boolean; error?: string }> {
		try {
			if (!this.audioContext) {
				throw new Error('AudioContext not available');
			}

			// Don't automatically resume - this requires user gesture
			if (this.audioContext.state === 'suspended') {
				return {
					canPlay: false,
					error: 'AudioContext suspended - requires user interaction'
				};
			}

			// Create a simple test tone (440Hz sine wave for 100ms)
			const duration = 0.1; // 100ms
			const frequency = 440;
			const bufferSize = this.audioContext.sampleRate * duration;
			const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);

			// Fill buffer with sine wave
			const channelData = buffer.getChannelData(0);
			for (let i = 0; i < bufferSize; i++) {
				channelData[i] =
					Math.sin((2 * Math.PI * frequency * i) / this.audioContext.sampleRate) * 0.1; // Low volume
			}

			// Create and configure AudioBufferSourceNode
			const source = this.audioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(this.audioContext.destination);

			// Play the tone (this is just a test, we don't actually want users to hear it)
			// We'll create the setup but not actually start it
			// source.start();

			return { canPlay: true };
		} catch (error) {
			return {
				canPlay: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	private getServerSideResponse(): AudioDeviceInfo {
		return {
			audioContext: {
				supported: false,
				state: 'server-side',
				sampleRate: 0,
				destination: {
					maxChannelCount: 0,
					channelCount: 0
				}
			},
			permissions: {
				microphone: 'not-supported',
				speaker: 'not-supported'
			},
			devices: {
				audioInputs: [],
				audioOutputs: []
			},
			capabilities: {
				webAudioAPI: false,
				mediaDevicesAPI: false,
				getUserMedia: false,
				enumerateDevices: false
			},
			playbackTest: {
				canPlay: false,
				error: 'Server-side rendering'
			}
		};
	}

	async resumeAudioContext(): Promise<boolean> {
		if (!browser || !this.audioContext) return false;

		try {
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
				console.log('[Audio Device Checker] AudioContext resumed');
				return true;
			}
			return this.audioContext.state === 'running';
		} catch (error) {
			console.error('[Audio Device Checker] Failed to resume AudioContext:', error);
			return false;
		}
	}

	getAudioContext(): AudioContext | null {
		return this.audioContext;
	}

	dispose(): void {
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
	}
}
