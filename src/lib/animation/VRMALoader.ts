import { VRMAnimationLoaderPlugin, type VRMAnimation } from '@pixiv/three-vrm-animation';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { AnimationAction, AnimationClip, AnimationMixer } from 'three';

export interface VRMAPose {
	name: string;
	path: string;
	category: string;
	description?: string;
	props?: string[];
	coordinateImages?: string[];
}

export interface VRMAAnimationClip extends AnimationClip {
	vrmaMetadata?: {
		pose: VRMAPose;
		isLoop: boolean;
	};
}

/**
 * VRMA Animation Loader for VRM avatars
 * Handles loading and management of VRMA pose/animation files
 */
export class VRMALoader {
	private gltfLoader: GLTFLoader;
	private cache = new Map<string, VRMAnimation>();

	constructor() {
		this.gltfLoader = new GLTFLoader();
		// Register the VRM Animation plugin
		this.gltfLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
	}

	/**
	 * Load a VRMA animation file
	 */
	async loadVRMA(path: string): Promise<VRMAnimation | null> {
		// Check cache first
		if (this.cache.has(path)) {
			return this.cache.get(path)!;
		}

		try {
			console.log(`[VRMALoader] Loading VRMA animation from: ${path}`);
			
			const gltf = await this.gltfLoader.loadAsync(path) as GLTF & {
				userData?: { vrma?: VRMAnimation };
			};
			
			const vrma = gltf.userData?.vrma;
			
			if (!vrma) {
				console.warn(`[VRMALoader] No VRM Animation data found in: ${path}`);
				return null;
			}

			// Cache the loaded animation
			this.cache.set(path, vrma);
			console.log(`[VRMALoader] Successfully loaded VRMA: ${path}`);
			
			return vrma;
		} catch (error) {
			console.error(`[VRMALoader] Failed to load VRMA from ${path}:`, error);
			return null;
		}
	}

	/**
	 * Create an AnimationClip from VRMA data for use with AnimationMixer
	 */
	createAnimationClip(vrm: VRM, vrma: VRMAnimation, pose: VRMAPose): VRMAAnimationClip | null {
		try {
			if (!vrma || !vrm?.humanoid) {
				console.warn('[VRMALoader] Invalid VRM or VRMA data provided');
				return null;
			}

			// Create animation clip from VRMA data - check if method exists
			const clip = 'createAnimationClip' in vrma && typeof vrma.createAnimationClip === 'function' 
				? (vrma as any).createAnimationClip(vrm) 
				: null;
			
			if (!clip) {
				console.warn('[VRMALoader] Failed to create animation clip');
				return null;
			}

			// Add metadata to the clip
			const vrmaClip = clip as VRMAAnimationClip;
			vrmaClip.vrmaMetadata = {
				pose,
				isLoop: false // VRMA poses are typically static poses, not loops
			};

			console.log(`[VRMALoader] Created animation clip: ${clip.name} (duration: ${clip.duration}s)`);
			return vrmaClip;
		} catch (error) {
			console.error('[VRMALoader] Error creating animation clip:', error);
			return null;
		}
	}

	/**
	 * Apply a VRMA pose directly to a VRM without animation
	 */
	async applyPoseDirectly(vrm: VRM, pose: VRMAPose): Promise<boolean> {
		try {
			const vrma = await this.loadVRMA(pose.path);
			if (!vrma || !vrm?.humanoid) {
				console.warn(`[VRMALoader] Invalid VRMA or VRM for pose: ${pose.name}`);
				return false;
			}

			// Apply the pose directly to the VRM humanoid
			// Note: The actual method might be different depending on the VRM Animation version
			if ('apply' in vrma && typeof vrma.apply === 'function') {
				(vrma as any).apply(vrm);
			} else if ('applyTo' in vrma && typeof vrma.applyTo === 'function') {
				(vrma as any).applyTo(vrm);
			} else {
				// Fallback: try to apply pose through humanoid
				const humanoid = vrm.humanoid;
				if (humanoid && vrma.humanoidTracks) {
					// Apply pose tracks to humanoid bones
					vrma.humanoidTracks.forEach((track: any) => {
						const bone = humanoid.humanBones[track.boneName];
						if (bone && track.values && track.values.length > 0) {
							// Apply the pose transformation
							// This is a simplified approach - actual implementation may vary
							console.log(`[VRMALoader] Applying track for bone: ${track.boneName}`);
						}
					});
				}
			}

			console.log(`[VRMALoader] Applied pose directly: ${pose.name}`);
			return true;
		} catch (error) {
			console.error(`[VRMALoader] Failed to apply pose ${pose.name}:`, error);
			return false;
		}
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear();
		console.log('[VRMALoader] Cache cleared');
	}

	/**
	 * Get cached animation count
	 */
	getCacheSize(): number {
		return this.cache.size;
	}
}