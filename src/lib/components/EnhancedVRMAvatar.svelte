<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { type VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
	import { loadVRMModel } from '$lib/vrm/loadVRMModel';
	import { Clock, Mesh } from 'three';

	import {
		EnhancedAnimationController,
		type AnimationPaths
	} from '$lib/animation/EnhancedAnimationController.svelte';

	let {
		modelPath = '/models/avatar.vrm',
		vrm = $bindable<VRM | null>(null),
		animationController = $bindable<EnhancedAnimationController | null>(null),
		enablePoseSystem = true
	}: {
		modelPath?: string;
		vrm?: VRM | null;
		animationController?: EnhancedAnimationController | null;
		enablePoseSystem?: boolean;
	} = $props();

	const animationPaths: AnimationPaths = {
		angry: ['/animations/talking-angry.fbx', '/animations/talking-arguing.fbx'],
		neutral: ['/animations/talking-neutral-1.fbx'],
		happy: ['/animations/talking-happy.fbx'],
		funny: ['/animations/talking-funny.fbx'],
		idle: [
			'/animations/idle.fbx',
			'/animations/idle-1.fbx',
			'/animations/idle-2.fbx',
			'/animations/idle-3.fbx'
		]
	};

	const clock = new Clock();
	const { scene: threlteScene } = useThrelte();

	async function loadVRMResources(
		path: string
	): Promise<{ vrm: VRM; animationController: EnhancedAnimationController } | null> {
		try {
			console.log('[EnhancedVRMAvatar] Loading VRM model from:', path);
			const loadedVRM = await loadVRMModel(path);
			console.log('[EnhancedVRMAvatar] VRM loaded successfully:', loadedVRM);

			if (loadedVRM.scene) {
				// Ensure meshes within the VRM model cast shadows
				loadedVRM.scene.traverse((child) => {
					if ((child as Mesh).isMesh) {
						const mesh = child as Mesh;
						mesh.castShadow = true;
						mesh.receiveShadow = true;
					}
				});

				// Initialize enhanced animation controller
				const newAnimationController = new EnhancedAnimationController(loadedVRM, animationPaths);
				console.log('[EnhancedVRMAvatar] EnhancedAnimationController initialized');
				
				return { vrm: loadedVRM, animationController: newAnimationController };
			}
			return null;
		} catch (error) {
			console.error('[EnhancedVRMAvatar] Failed to load VRM model from', path, ':', error);
			return null;
		}
	}

	// React to modelPath changes, handling race conditions
	$effect(() => {
		if (modelPath) {
			let ignore = false;
			console.log('[EnhancedVRMAvatar] Model path changed, loading:', modelPath);

			// Clear old avatar immediately for better UX
			vrm = null;
			animationController = null;

			loadVRMResources(modelPath).then((resources) => {
				if (ignore) return;

				if (resources) {
					vrm = resources.vrm;
					animationController = resources.animationController;
					
					// Log available pose categories if pose system is enabled
					if (enablePoseSystem && resources.animationController) {
						const poses = resources.animationController.getAvailablePoses();
						const categories = Object.keys(poses);
						console.log('[EnhancedVRMAvatar] Available pose categories:', categories);
						console.log('[EnhancedVRMAvatar] Total poses available:', Object.values(poses).flat().length);
					}
				}
			});

			return () => {
				ignore = true;
			};
		}
	});

	$effect(() => {
		if (vrm) {
			const vrmInstance = vrm; // Capture reactive value for the effect
			const currentThrelteScene = threlteScene;
			const currentAnimationController = animationController;

			if (vrmInstance?.scene && currentThrelteScene) {
				const modelScene = vrmInstance.scene;
				currentThrelteScene.add(modelScene);
				
				// Avatar position
				modelScene.position.set(-0.5, -0.5, -2.2);
				modelScene.rotation.set(0, 0.2, 0);
				modelScene.scale.set(1, 1, 1);

				console.log('[EnhancedVRMAvatar] VRM added to scene at position:', modelScene.position);

				return () => {
					if (currentThrelteScene.children.includes(modelScene)) {
						currentThrelteScene.remove(modelScene);
					}
					// Clean up the specific animation controller instance for this effect
					if (currentAnimationController) {
						currentAnimationController.destroy();
					}
				};
			}
		}
	});

	let lastBlinkTime = $state(0);
	let nextBlinkInterval = $state(2 + Math.random() * 5);

	useTask((delta: number) => {
		if (!vrm?.scene || !vrm.humanoid) return;

		const elapsedTime = clock.getElapsedTime();

		// Update animation controller
		if (animationController) {
			animationController.update(delta);
		}

		// Blinking logic - only blink if not in a specific pose that might control expressions
		const currentPose = animationController?.getCurrentPose();
		const shouldBlink = !currentPose || animationController?.getCurrentState() !== 'posing';

		if (vrm.expressionManager && shouldBlink && elapsedTime - lastBlinkTime > nextBlinkInterval) {
			vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, 1);

			setTimeout(() => {
				if (vrm && vrm.expressionManager) {
					vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, 0);
				}
				lastBlinkTime = elapsedTime;
				nextBlinkInterval = 2 + Math.random() * 5;
			}, 150);
		}

		// VRM internal updates
		if (vrm) {
			vrm.update(delta);
		}

		// Force update of model's world matrix after all manipulations
		if (vrm?.scene) {
			vrm.scene.updateMatrixWorld(true);
		}
	});

	// Debug function to log pose system status
	function logPoseSystemStatus() {
		if (animationController && enablePoseSystem) {
			const currentState = animationController.getCurrentState();
			const currentPose = animationController.getCurrentPose();
			const categories = Object.keys(animationController.getAvailablePoses());
			
			console.log('[EnhancedVRMAvatar] Pose System Status:', {
				enabled: enablePoseSystem,
				currentState,
				currentPose: currentPose?.name || 'none',
				availableCategories: categories,
				totalPoses: Object.values(animationController.getAvailablePoses()).flat().length
			});
		} else {
			console.log('[EnhancedVRMAvatar] Pose System: Disabled or not initialized');
		}
	}

	// Expose debug function globally for development
	if (typeof window !== 'undefined') {
		(window as any).logVRMPoseStatus = logPoseSystemStatus;
	}
</script>

<!-- The VRM avatar is managed through the scene and doesn't render any HTML directly -->
<!-- This component handles the 3D model loading, animation, and pose system integration -->