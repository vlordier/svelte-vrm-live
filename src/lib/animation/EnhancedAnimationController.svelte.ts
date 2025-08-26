import type { VRM } from '@pixiv/three-vrm';
import { AnimationMixer, type AnimationAction, LoopRepeat, LoopOnce, type Object3D } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { remapMixamoAnimationToVrm } from '$lib/mixamo/remapMixamoAnimationToVrm';
import type { Emotion } from '$lib/audio/tts';
import { VRMALoader, type VRMAPose, type VRMAAnimationClip } from './VRMALoader';
import { PoseCatalog } from './PoseCatalog';

export type AnimationState = 'idle' | 'talking' | 'posing';
export type AnimationType = 'fbx' | 'vrma';

export interface AnimationPaths {
	angry: string[];
	neutral: string[];
	happy: string[];
	funny: string[];
	idle: string[];
}

export interface EnhancedAnimationOptions {
	animationType?: AnimationType;
	pose?: VRMAPose;
	emotion?: Emotion;
	loop?: boolean;
	duration?: number;
}

/**
 * Enhanced Animation Controller supporting both FBX (Mixamo) and VRMA animations
 */
export class EnhancedAnimationController {
	private vrm: VRM;
	private mixer: AnimationMixer;
	private fbxLoader: FBXLoader;
	private gltfLoader: GLTFLoader;
	private vrmaLoader: VRMALoader;
	private currentAction: AnimationAction | null = null;
	private currentState: AnimationState = 'idle';
	private animationPaths: AnimationPaths;
	private transitionTimeout: number | null = null;
	private currentPose: VRMAPose | null = null;
	private loadedProps: Object3D[] = [];

	constructor(vrm: VRM, animationPaths: AnimationPaths) {
		this.vrm = vrm;
		this.mixer = new AnimationMixer(vrm.scene);
		this.fbxLoader = new FBXLoader();
		this.gltfLoader = new GLTFLoader();
		this.vrmaLoader = new VRMALoader();
		this.animationPaths = animationPaths;
		this.startIdleAnimation();
	}

	private async startIdleAnimation() {
		try {
			const idlePaths = this.animationPaths.idle;
			if (idlePaths.length > 0) {
				const randomIdlePath = idlePaths[Math.floor(Math.random() * idlePaths.length)];
				await this.playFBXAnimation(randomIdlePath, true);
			}
		} catch (error) {
			console.warn('[EnhancedAnimationController] Failed to start idle animation:', error);
		}
	}

	/**
	 * Play an FBX animation (legacy Mixamo animations)
	 */
	private async playFBXAnimation(animationPath: string, loop: boolean = false): Promise<void> {
		try {
			console.log(`[EnhancedAnimationController] Playing FBX: ${animationPath}, loop: ${loop}`);
			const fbxModel = await this.fbxLoader.loadAsync(animationPath);

			if (!fbxModel.animations || fbxModel.animations.length === 0) {
				console.warn(`[EnhancedAnimationController] No animations in FBX: ${animationPath}`);
				return;
			}

			const remappedClip = remapMixamoAnimationToVrm(this.vrm, fbxModel);
			if (!remappedClip) {
				console.warn(`[EnhancedAnimationController] Failed to remap: ${animationPath}`);
				return;
			}

			await this.playAnimationClip(remappedClip, loop);
		} catch (error) {
			console.error(`[EnhancedAnimationController] Error playing FBX animation ${animationPath}:`, error);
		}
	}

	/**
	 * Play a VRMA pose/animation
	 */
	async playVRMAPose(pose: VRMAPose, options: EnhancedAnimationOptions = {}): Promise<boolean> {
		try {
			console.log(`[EnhancedAnimationController] Playing VRMA pose: ${pose.name}`);
			
			// Clear previous pose state
			this.clearProps();
			
			// Load and apply VRMA
			const vrma = await this.vrmaLoader.loadVRMA(pose.path);
			if (!vrma) {
				console.error(`[EnhancedAnimationController] Failed to load VRMA: ${pose.path}`);
				return false;
			}

			// Create animation clip from VRMA
			const clip = this.vrmaLoader.createAnimationClip(this.vrm, vrma, pose);
			if (!clip) {
				console.error(`[EnhancedAnimationController] Failed to create clip for: ${pose.name}`);
				return false;
			}

			// Load props if specified
			if (pose.props && pose.props.length > 0) {
				await this.loadProps(pose.props);
			}

			// Play the animation
			await this.playAnimationClip(clip, options.loop || false);
			
			this.currentPose = pose;
			this.currentState = 'posing';
			
			console.log(`[EnhancedAnimationController] Successfully applied VRMA pose: ${pose.name}`);
			return true;
		} catch (error) {
			console.error(`[EnhancedAnimationController] Error playing VRMA pose ${pose.name}:`, error);
			return false;
		}
	}

	/**
	 * Apply a VRMA pose directly without animation
	 */
	async applyPoseDirectly(pose: VRMAPose): Promise<boolean> {
		try {
			console.log(`[EnhancedAnimationController] Applying pose directly: ${pose.name}`);
			
			// Stop current animation
			if (this.currentAction) {
				this.currentAction.stop();
				this.currentAction = null;
			}

			// Clear previous props
			this.clearProps();
			
			// Apply pose directly
			const success = await this.vrmaLoader.applyPoseDirectly(this.vrm, pose);
			
			if (success) {
				// Load props if specified
				if (pose.props && pose.props.length > 0) {
					await this.loadProps(pose.props);
				}
				
				this.currentPose = pose;
				this.currentState = 'posing';
				console.log(`[EnhancedAnimationController] Successfully applied pose: ${pose.name}`);
			}
			
			return success;
		} catch (error) {
			console.error(`[EnhancedAnimationController] Error applying pose ${pose.name}:`, error);
			return false;
		}
	}

	/**
	 * Play an animation clip (generic method for both FBX and VRMA)
	 */
	private async playAnimationClip(clip: any, loop: boolean = false): Promise<void> {
		const newAction = this.mixer.clipAction(clip);
		
		if (loop) {
			newAction.setLoop(LoopRepeat, Infinity);
		} else {
			newAction.setLoop(LoopOnce, 1);
			newAction.clampWhenFinished = true;
		}

		const oldAction = this.currentAction;
		this.currentAction = newAction;

		if (oldAction) {
			if (oldAction.getClip() === newAction.getClip() && oldAction !== newAction) {
				oldAction.stop();
				this.mixer.uncacheAction(oldAction.getClip(), this.vrm.scene);
				console.log(`[EnhancedAnimationController] Stopped duplicate old action for clip: ${clip.name}`);
				newAction.reset().play();
			} else if (oldAction !== newAction) {
				console.log(`[EnhancedAnimationController] Crossfading from ${oldAction.getClip().name} to ${newAction.getClip().name}`);

				if (!oldAction.isRunning()) {
					oldAction.reset().play();
				}

				newAction.play();
				oldAction.crossFadeTo(newAction, 0.3, false);

				setTimeout(() => {
					oldAction.stop();
					this.mixer.uncacheAction(oldAction.getClip(), this.vrm.scene);
					console.log(`[EnhancedAnimationController] Cleaned up old action: ${oldAction.getClip().name}`);
				}, 300);
			} else {
				console.log(`[EnhancedAnimationController] Resetting and playing same action instance: ${clip.name}`);
				newAction.reset().play();
			}
		} else {
			console.log(`[EnhancedAnimationController] Playing initial animation: ${clip.name}`);
			newAction.reset().play();
		}
	}

	/**
	 * Load 3D props for poses
	 */
	private async loadProps(propNames: string[]): Promise<void> {
		try {
			for (const propName of propNames) {
				const propPath = PoseCatalog.getPropPath(propName);
				if (propPath) {
					console.log(`[EnhancedAnimationController] Loading prop: ${propName}`);
					const gltf = await this.gltfLoader.loadAsync(propPath);
					
					if (gltf.scene) {
						// Add prop to VRM scene
						this.vrm.scene.add(gltf.scene);
						this.loadedProps.push(gltf.scene);
						
						// Position props based on their type (this would need pose-specific positioning)
						this.positionProp(gltf.scene, propName);
						
						console.log(`[EnhancedAnimationController] Loaded prop: ${propName}`);
					}
				} else {
					console.warn(`[EnhancedAnimationController] Prop not found: ${propName}`);
				}
			}
		} catch (error) {
			console.error(`[EnhancedAnimationController] Error loading props:`, error);
		}
	}

	/**
	 * Position a prop relative to the VRM (basic positioning - would need refinement per pose)
	 */
	private positionProp(propObject: Object3D, propName: string): void {
		// Basic prop positioning - this would need to be refined based on coordinate images
		switch (propName) {
			case 'handcuffs.glb':
				// Position handcuffs on wrists
				propObject.position.set(0, 1, 0);
				break;
			case 'park_bench.glb':
				// Position bench beneath avatar
				propObject.position.set(0, -1, 0);
				break;
			case 'phone.glb':
				// Position phone in hand
				propObject.position.set(0.2, 1.2, -0.1);
				break;
			case 'cock3.glb':
			case 'cockv.glb':
				// Position based on coordinate images (would need specific positioning per pose)
				propObject.position.set(0, 0.8, -0.2);
				break;
			default:
				console.warn(`[EnhancedAnimationController] Unknown prop positioning: ${propName}`);
		}
		
		// Make props visible
		propObject.visible = true;
	}

	/**
	 * Clear all loaded props
	 */
	private clearProps(): void {
		this.loadedProps.forEach(prop => {
			if (this.vrm.scene.children.includes(prop)) {
				this.vrm.scene.remove(prop);
			}
		});
		this.loadedProps = [];
	}

	/**
	 * Get all available poses by category
	 */
	getAvailablePoses(): Record<string, VRMAPose[]> {
		return PoseCatalog.poses;
	}

	/**
	 * Get poses by category
	 */
	getPosesByCategory(category: string): VRMAPose[] {
		return PoseCatalog.getPosesByCategory(category);
	}

	/**
	 * Search poses
	 */
	searchPoses(query: string): VRMAPose[] {
		return PoseCatalog.searchPoses(query);
	}

	/**
	 * Start talking animation (FBX-based)
	 */
	async startTalking(emotion?: Emotion): Promise<void> {
		if (this.transitionTimeout) {
			clearTimeout(this.transitionTimeout);
			this.transitionTimeout = null;
		}

		if (this.currentState === 'talking') return;

		this.currentState = 'talking';
		console.log('[EnhancedAnimationController] startTalking: Transitioning to talking state.');
		await this.playTalkingAnimation(emotion || 'neutral');
	}

	private async playTalkingAnimation(emotion: Emotion): Promise<void> {
		let animationPaths: string[];

		switch (emotion) {
			case 'angry':
				animationPaths = this.animationPaths.angry;
				break;
			case 'happy':
				animationPaths = this.animationPaths.happy;
				break;
			case 'funny':
				animationPaths = this.animationPaths.funny;
				break;
			default:
				animationPaths = this.animationPaths.neutral;
		}

		if (animationPaths.length > 0) {
			const randomPath = animationPaths[Math.floor(Math.random() * animationPaths.length)];
			await this.playFBXAnimation(randomPath, true);
		}
	}

	/**
	 * Stop talking and return to idle/previous state
	 */
	async stopTalking(): Promise<void> {
		if (this.currentState !== 'talking') return;
		if (this.transitionTimeout) return;

		console.log('[EnhancedAnimationController] stopTalking: Queuing transition to idle state.');
		this.transitionTimeout = window.setTimeout(async () => {
			if (this.currentState === 'talking') {
				this.currentState = 'idle';
				console.log('[EnhancedAnimationController] stopTalking: Executing transition to idle state.');
				await this.startIdleAnimation();
			}
			this.transitionTimeout = null;
		}, 200);
	}

	/**
	 * Return to idle animation from any state
	 */
	async returnToIdle(): Promise<void> {
		this.clearProps();
		this.currentPose = null;
		this.currentState = 'idle';
		await this.startIdleAnimation();
	}

	/**
	 * Update animation mixer
	 */
	update(deltaTime: number): void {
		this.mixer.update(deltaTime);
	}

	/**
	 * Get current animation state
	 */
	getCurrentState(): AnimationState {
		return this.currentState;
	}

	/**
	 * Get current pose if in posing state
	 */
	getCurrentPose(): VRMAPose | null {
		return this.currentPose;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.transitionTimeout) {
			clearTimeout(this.transitionTimeout);
		}
		if (this.currentAction) {
			this.currentAction.stop();
		}
		this.clearProps();
		this.vrmaLoader.clearCache();
	}
}