<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core';
	import { type VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
	import { loadVRMModel } from '$lib/vrm/loadVRMModel';
	import { Clock, Mesh } from 'three';

	import {
		AnimationController,
		type AnimationPaths
	} from '$lib/animation/AnimationController.svelte';

	let {
		modelPath = '/models/avatar.vrm',
		vrm = $bindable<VRM | null>(null),
		animationController = $bindable<AnimationController | null>(null)
	}: {
		modelPath?: string;
		vrm?: VRM | null;
		animationController?: AnimationController | null;
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
	): Promise<{ vrm: VRM; animationController: AnimationController } | null> {
		try {
			console.log('[VRMAvatar] Loading VRM model from:', path);
			const loadedVRM = await loadVRMModel(path);
			console.log('[VRMAvatar] VRM loaded successfully:', loadedVRM);

			if (loadedVRM.scene) {
				// Ensure meshes within the VRM model cast shadows
				loadedVRM.scene.traverse((child) => {
					if ((child as Mesh).isMesh) {
						const mesh = child as Mesh;
						mesh.castShadow = true;
						mesh.receiveShadow = true;
					}
				});

				// Initialize animation controller
				const newAnimationController = new AnimationController(loadedVRM, animationPaths);
				console.log('[VRMAvatar] AnimationController initialized');
				return { vrm: loadedVRM, animationController: newAnimationController };
			}
			return null;
		} catch (error) {
			console.error('[VRMAvatar] Failed to load VRM model from', path, ':', error);
			return null;
		}
	}

	// React to modelPath changes, handling race conditions
	$effect(() => {
		if (modelPath) {
			let ignore = false;
			console.log('[VRMAvatar] Model path changed, loading:', modelPath);

			// Clear old avatar immediately for better UX
			vrm = null;
			animationController = null;

			loadVRMResources(modelPath).then((resources) => {
				if (ignore) return;

				if (resources) {
					vrm = resources.vrm;
					animationController = resources.animationController;
				} else {
					vrm = null;
					animationController = null;
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
			const currentAnimationController = animationController; // Capture the specific animation controller instance

			if (vrmInstance?.scene && currentThrelteScene) {
				const modelScene = vrmInstance.scene;
				currentThrelteScene.add(modelScene);
				// Avatar position
				modelScene.position.set(-0.5, -0.5, -2.2); // Adjusted position
				modelScene.rotation.set(0, 0.2, 0);
				modelScene.scale.set(1, 1, 1);

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

		// Blinking and Expression Cycling can happen regardless of primary animation (VRMA or embedded)
		// but consider if they should be disabled if a VRMA controls expressions.
		if (vrm.expressionManager && elapsedTime - lastBlinkTime > nextBlinkInterval) {
			// Added !vrmaAction
			// blinkState = true;
			vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, 1);

			setTimeout(() => {
				if (vrm && vrm.expressionManager) {
					vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, 0);
				}
				// blinkState = false;
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
</script>
