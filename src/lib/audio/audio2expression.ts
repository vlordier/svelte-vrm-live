import type { VRM } from '@pixiv/three-vrm';
import { VRMExpressionPresetName } from '@pixiv/three-vrm';

// ARKit blendshape names mapped to available VRM expressions
const ARKitToVRMMapping: Record<string, VRMExpressionPresetName | null> = {
	// Mouth expressions
	mouthOpen: VRMExpressionPresetName.Aa,
	mouthSmile: VRMExpressionPresetName.Happy,
	mouthFrown: VRMExpressionPresetName.Sad,
	mouthPucker: VRMExpressionPresetName.Ou,
	mouthFunnel: VRMExpressionPresetName.Oh,
	mouthRollUpper: null, // No direct VRM equivalent
	mouthRollLower: null, // No direct VRM equivalent
	mouthShrugUpper: null, // No direct VRM equivalent
	mouthShrugLower: null, // No direct VRM equivalent
	mouthClose: VRMExpressionPresetName.Neutral,
	mouthUpperUp: null, // No direct VRM equivalent
	mouthLowerDown: VRMExpressionPresetName.Aa,
	mouthLeft: null, // No direct VRM equivalent
	mouthRight: null, // No direct VRM equivalent
	mouthSmileLeft: VRMExpressionPresetName.Happy,
	mouthSmileRight: VRMExpressionPresetName.Happy,
	mouthFrownLeft: VRMExpressionPresetName.Sad,
	mouthFrownRight: VRMExpressionPresetName.Sad,
	mouthDimpleLeft: null, // No direct VRM equivalent
	mouthDimpleRight: null, // No direct VRM equivalent
	mouthStretchLeft: null, // No direct VRM equivalent
	mouthStretchRight: null, // No direct VRM equivalent
	mouthPressLeft: null, // No direct VRM equivalent
	mouthPressRight: null, // No direct VRM equivalent

	// Eye expressions
	eyeBlinkLeft: VRMExpressionPresetName.BlinkLeft,
	eyeBlinkRight: VRMExpressionPresetName.BlinkRight,
	eyeLookUpLeft: VRMExpressionPresetName.LookUp,
	eyeLookUpRight: VRMExpressionPresetName.LookUp,
	eyeLookDownLeft: VRMExpressionPresetName.LookDown,
	eyeLookDownRight: VRMExpressionPresetName.LookDown,
	eyeLookInLeft: VRMExpressionPresetName.LookRight,
	eyeLookInRight: VRMExpressionPresetName.LookLeft,
	eyeLookOutLeft: VRMExpressionPresetName.LookLeft,
	eyeLookOutRight: VRMExpressionPresetName.LookRight,
	eyeWideLeft: VRMExpressionPresetName.Surprised,
	eyeWideRight: VRMExpressionPresetName.Surprised,
	eyeSquintLeft: null, // No direct VRM equivalent
	eyeSquintRight: null, // No direct VRM equivalent

	// Brow expressions
	browDownLeft: VRMExpressionPresetName.Angry,
	browDownRight: VRMExpressionPresetName.Angry,
	browInnerUp: VRMExpressionPresetName.Surprised,
	browOuterUpLeft: VRMExpressionPresetName.Surprised,
	browOuterUpRight: VRMExpressionPresetName.Surprised,

	// Cheek expressions
	cheekPuff: null, // No direct VRM equivalent
	cheekSquintLeft: null, // No direct VRM equivalent
	cheekSquintRight: null, // No direct VRM equivalent

	// Jaw expressions
	jawOpen: VRMExpressionPresetName.Aa,
	jawForward: null, // No direct VRM equivalent
	jawLeft: null, // No direct VRM equivalent
	jawRight: null, // No direct VRM equivalent

	// Nose expressions
	noseSneerLeft: null, // No direct VRM equivalent
	noseSneerRight: null, // No direct VRM equivalent

	// Tongue expressions
	tongueOut: null // No direct VRM equivalent
};

export interface BlendshapeData {
	blendshapes: Record<string, number>; // ARKit blendshape name -> weight (0-1)
	timestamp: number; // Time in seconds
}

export interface Audio2ExpressionConfig {
	modelUrl?: string; // URL to LAM_Audio2Expression model endpoint
	fallbackToPhonemes: boolean; // Use existing phoneme system as fallback
	smoothingFactor: number; // 0-1, for temporal smoothing
	intensityMultiplier: number; // Scale blendshape weights
	debugLogging: boolean;
	webSocketUrl?: string; // WebSocket URL for real-time connection
	useWebSocket?: boolean; // Enable WebSocket mode
}

export const defaultAudio2ExpressionConfig: Audio2ExpressionConfig = {
	fallbackToPhonemes: true,
	smoothingFactor: 0.3,
	intensityMultiplier: 1.0,
	debugLogging: true,
	webSocketUrl: 'ws://localhost:8001/ws',
	useWebSocket: true
};

export class Audio2ExpressionAnimator {
	private vrm: VRM;
	private config: Audio2ExpressionConfig;
	private currentBlendshapes: Map<VRMExpressionPresetName, number> = new Map();
	private animationId: number | null = null;
	private isActive = false;
	private webSocket: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;

	constructor(vrm: VRM, config: Partial<Audio2ExpressionConfig> = {}) {
		this.vrm = vrm;
		this.config = { ...defaultAudio2ExpressionConfig, ...config };

		// Initialize all expressions to neutral
		this.resetExpressions();

		// Initialize WebSocket connection if enabled
		if (this.config.useWebSocket) {
			this.initializeWebSocket();
		}
	}

	private resetExpressions(): void {
		if (!this.vrm.expressionManager) return;

		Object.values(VRMExpressionPresetName).forEach((preset) => {
			const value = preset === VRMExpressionPresetName.Neutral ? 1.0 : 0.0;
			this.currentBlendshapes.set(preset, value);
			this.vrm.expressionManager?.setValue(preset, value);
		});
	}

	private initializeWebSocket(): void {
		if (!this.config.webSocketUrl) {
			if (this.config.debugLogging) {
				console.warn('[Audio2Expression] WebSocket URL not configured');
			}
			return;
		}

		try {
			if (this.config.debugLogging) {
				console.log(`[Audio2Expression] Connecting to WebSocket: ${this.config.webSocketUrl}`);
			}

			this.webSocket = new WebSocket(this.config.webSocketUrl);

			this.webSocket.onopen = () => {
				if (this.config.debugLogging) {
					console.log('[Audio2Expression] WebSocket connected!');
				}
				this.reconnectAttempts = 0;

				// Send ping to confirm connection
				this.webSocket?.send(JSON.stringify({ type: 'ping', message: 'VRM client connected' }));
			};

			this.webSocket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					
					if (data.type === 'blendshapes' && data.blendshapes) {
						// Apply real-time blendshapes from Python server
						const blendshapeData: BlendshapeData = {
							blendshapes: data.blendshapes,
							timestamp: data.timestamp || performance.now() / 1000
						};

						if (this.config.debugLogging) {
							const activeShapes = Object.entries(data.blendshapes)
								.filter(([_, v]) => v > 0.01)
								.map(([k]) => k);
							if (activeShapes.length > 0) {
								console.log(`[Audio2Expression] WebSocket received: ${activeShapes.join(', ')}`);
							}
						}

						this.applyBlendshapes(blendshapeData);
					} else if (this.config.debugLogging && data.type === 'pong') {
						console.log('[Audio2Expression] WebSocket pong received');
					}
				} catch (error) {
					if (this.config.debugLogging) {
						console.error('[Audio2Expression] WebSocket message parse error:', error);
					}
				}
			};

			this.webSocket.onclose = () => {
				if (this.config.debugLogging) {
					console.log('[Audio2Expression] WebSocket disconnected');
				}
				this.webSocket = null;

				// Auto-reconnect if still active
				if (this.isActive && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.reconnectAttempts++;
					setTimeout(() => {
						if (this.config.debugLogging) {
							console.log(`[Audio2Expression] Attempting WebSocket reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
						}
						this.initializeWebSocket();
					}, 2000 * this.reconnectAttempts); // Exponential backoff
				}
			};

			this.webSocket.onerror = (error) => {
				if (this.config.debugLogging) {
					console.error('[Audio2Expression] WebSocket error:', error);
				}
			};

		} catch (error) {
			if (this.config.debugLogging) {
				console.error('[Audio2Expression] Failed to initialize WebSocket:', error);
			}
		}
	}

	private mapBlendshapesToVRM(
		blendshapeData: BlendshapeData
	): Map<VRMExpressionPresetName, number> {
		const vrmWeights = new Map<VRMExpressionPresetName, number>();

		// Initialize with current weights
		this.currentBlendshapes.forEach((weight, preset) => {
			vrmWeights.set(preset, weight);
		});

		// Map ARKit blendshapes to VRM expressions
		Object.entries(blendshapeData.blendshapes).forEach(([arkitName, weight]) => {
			const vrmPreset = ARKitToVRMMapping[arkitName];
			if (vrmPreset && weight > 0.001) {
				// Ignore very small weights
				const scaledWeight = weight * this.config.intensityMultiplier;
				const currentWeight = vrmWeights.get(vrmPreset) || 0;

				// Accumulate weights for expressions that might be triggered by multiple ARKit blendshapes
				const finalWeight = Math.min(1.0, currentWeight + scaledWeight);
				vrmWeights.set(vrmPreset, finalWeight);
				
				// Debug key mappings
				if (this.config.debugLogging && (arkitName === 'jawOpen' || arkitName === 'mouthOpen')) {
					console.log(`[Audio2Expression] Mapping ${arkitName} (${weight.toFixed(3)}) -> ${vrmPreset} (${finalWeight.toFixed(3)})`);
				}
			} else if (this.config.debugLogging && weight > 0.001) {
				console.log(`[Audio2Expression] No VRM mapping for ${arkitName} (${weight.toFixed(3)})`);
			}
		});

		// Apply smoothing
		if (this.config.smoothingFactor > 0) {
			vrmWeights.forEach((newWeight, preset) => {
				const currentWeight = this.currentBlendshapes.get(preset) || 0;
				const smoothedWeight =
					currentWeight * this.config.smoothingFactor +
					newWeight * (1 - this.config.smoothingFactor);
				vrmWeights.set(preset, smoothedWeight);
			});
		}

		return vrmWeights;
	}

	applyBlendshapes(blendshapeData: BlendshapeData): void {
		if (!this.vrm.expressionManager || !this.isActive) {
			if (this.config.debugLogging) {
				console.warn('[Audio2Expression] Cannot apply blendshapes:', {
					hasExpressionManager: !!this.vrm.expressionManager,
					isActive: this.isActive
				});
			}
			return;
		}

		const vrmWeights = this.mapBlendshapesToVRM(blendshapeData);

		// Apply weights to VRM
		vrmWeights.forEach((weight, preset) => {
			this.vrm.expressionManager?.setValue(preset, weight);
			this.currentBlendshapes.set(preset, weight);
		});

		if (this.config.debugLogging) {
			const activeBlendshapes = Object.fromEntries(
				Array.from(vrmWeights.entries()).filter(([_, w]) => w > 0.01)
			);
			if (Object.keys(activeBlendshapes).length > 0) {
				console.log('[Audio2Expression] Applied blendshapes:', activeBlendshapes);
			}
			
			// Log raw ARKit input for debugging
			const activeARKit = Object.fromEntries(
				Object.entries(blendshapeData.blendshapes).filter(([_, w]) => w > 0.01)
			);
			if (Object.keys(activeARKit).length > 0) {
				console.log('[Audio2Expression] Raw ARKit blendshapes:', activeARKit);
			}
		}
	}

	async processAudioBuffer(audioBuffer: AudioBuffer): Promise<BlendshapeData[]> {
		const apiUrl = this.config.modelUrl || '/api/audio2expression';

		try {
			// Convert AudioBuffer to base64
			const audioData = this.audioBufferToBase64(audioBuffer);

			if (this.config.debugLogging) {
				console.log('[Audio2Expression] Sending audio to:', apiUrl);
			}

			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					audio: audioData,
					sample_rate: audioBuffer.sampleRate,
					format: 'wav',
					config: {
						smoothing: this.config.smoothingFactor,
						intensity: this.config.intensityMultiplier
					}
				})
			});

			if (!response.ok) {
				throw new Error(`Audio2Expression API error: ${response.status}`);
			}

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error || 'API returned error status');
			}

			if (this.config.debugLogging) {
				console.log(
					`[Audio2Expression] Received ${result.blendshapes?.length || 0} blendshape frames`
				);
			}

			return result.blendshapes || [];
		} catch (error) {
			console.error('[Audio2Expression] API call failed:', error);

			if (this.config.fallbackToPhonemes) {
				console.log('[Audio2Expression] Falling back to phoneme-based animation');
				return [];
			}

			throw error;
		}
	}

	private audioBufferToBase64(audioBuffer: AudioBuffer): string {
		// Convert AudioBuffer to Float32Array
		const channelData = audioBuffer.getChannelData(0);

		// Convert to ArrayBuffer
		const arrayBuffer = new ArrayBuffer(channelData.length * 4);
		const view = new Float32Array(arrayBuffer);
		view.set(channelData);

		// Convert to base64
		let binary = '';
		const bytes = new Uint8Array(arrayBuffer);
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}

		// Use globalThis.btoa for browser compatibility
		return globalThis.btoa(binary);
	}

	start(): void {
		this.isActive = true;
		if (this.config.debugLogging) {
			console.log('[Audio2Expression] Animator started');
		}

		// Ensure WebSocket is connected if enabled
		if (this.config.useWebSocket && !this.webSocket) {
			this.initializeWebSocket();
		}
	}

	stop(): void {
		this.isActive = false;
		if (this.animationId !== null) {
			globalThis.cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.resetExpressions();

		// Close WebSocket connection
		if (this.webSocket) {
			this.webSocket.close();
			this.webSocket = null;
		}

		if (this.config.debugLogging) {
			console.log('[Audio2Expression] Animator stopped and expressions reset');
		}
	}

	isRunning(): boolean {
		return this.isActive;
	}
}

// Main function to integrate with existing TTS pipeline
export async function speakWithAudio2Expression(
	text: string,
	vrm: VRM,
	config: Partial<Audio2ExpressionConfig> = {}
): Promise<void> {
	const finalConfig = { ...defaultAudio2ExpressionConfig, ...config };
	const animator = new Audio2ExpressionAnimator(vrm, finalConfig);

	try {
		// Get audio from existing TTS system
		const response = await fetch('/api/tts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		});

		if (!response.ok) {
			throw new Error(`TTS API error: ${response.status}`);
		}

		const data = await response.json();

		// Convert to AudioBuffer (reuse existing logic)
		const audioBase64 = data.audio_base64 || data.audio;
		const audioData = globalThis.atob(audioBase64);
		const audioArrayBuffer = new ArrayBuffer(audioData.length);
		const audioView = new Uint8Array(audioArrayBuffer);
		for (let i = 0; i < audioData.length; i++) {
			audioView[i] = audioData.charCodeAt(i);
		}

		const float32Data = new Float32Array(audioArrayBuffer);
		const audioCtx = new AudioContext();
		const sampleRate = data.sample_rate || 24000;
		const audioBuffer = audioCtx.createBuffer(1, float32Data.length, sampleRate);
		audioBuffer.getChannelData(0).set(float32Data);

		// Start animation
		animator.start();

		// Process audio through Audio2Expression model
		try {
			const blendshapeSequence = await animator.processAudioBuffer(audioBuffer);

			if (blendshapeSequence.length > 0) {
				// Start real-time animation playback
				const startTime = performance.now();
				let currentFrame = 0;
				
				const animateFrame = () => {
					if (!animator.isRunning() || currentFrame >= blendshapeSequence.length) {
						return;
					}
					
					const elapsed = (performance.now() - startTime) / 1000; // seconds
					const frame = blendshapeSequence[currentFrame];
					
					// Apply current frame if we've reached its timestamp
					if (elapsed >= frame.timestamp) {
						animator.applyBlendshapes(frame);
						currentFrame++;
						
						if (finalConfig.debugLogging && currentFrame % 10 === 0) {
							console.log(`[Audio2Expression] Applied frame ${currentFrame}/${blendshapeSequence.length}`);
						}
					}
					
					// Continue animation
					requestAnimationFrame(animateFrame);
				};
				
				// Start the animation loop
				requestAnimationFrame(animateFrame);

				if (finalConfig.debugLogging) {
					console.log(
						`[Audio2Expression] Started real-time animation with ${blendshapeSequence.length} frames`
					);
				}
			} else {
				throw new Error('No blendshape data received from model');
			}
		} catch (error) {
			console.error('[Audio2Expression] Model processing failed:', error);
			if (finalConfig.fallbackToPhonemes) {
				console.log('[Audio2Expression] Falling back to phoneme-based lip sync');
				// Import and use the phoneme-based system
				const { speakWithLipsync } = await import('./tts');
				animator.stop();
				await speakWithLipsync(text, vrm, {
					intensity: finalConfig.intensityMultiplier,
					smoothing: finalConfig.smoothingFactor,
					debugLogging: finalConfig.debugLogging
				});
				return;
			} else {
				throw error;
			}
		}

		// Play audio
		const audioSource = audioCtx.createBufferSource();
		audioSource.buffer = audioBuffer;
		audioSource.connect(audioCtx.destination);
		audioSource.start();

		// Stop animation after audio ends
		setTimeout(
			() => {
				animator.stop();
			},
			(audioBuffer.duration + 0.5) * 1000
		);

		if (finalConfig.debugLogging) {
			console.log('[Audio2Expression] Speech with audio2expression completed');
		}
	} catch (error) {
		animator.stop();
		throw error;
	}
}
