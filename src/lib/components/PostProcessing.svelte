<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { EffectComposer, RenderPass, EffectPass } from 'postprocessing';
	import { DepthOfFieldEffect, VignetteEffect, BloomEffect } from 'postprocessing';
	import * as THREE from 'three';

	const { scene, camera, renderer } = useThrelte();

	// Effect controls - props for individual effects
	let {
		enableDepthBlur = false,
		enableVignette = false,
		enableBloom = false,
		// Depth of Field settings
		focusDistance = 0.05, // focus close (so far plane gets blur)
		focalLength = 0.02, // short lens; smaller = subtler blur transition
		bokehScale = 0.85, // tiny bokeh; keep < 1 for "just a hint"
		// Vignette settings
		vignetteOffset = 0.3, // start falloff near edges
		vignetteDarkness = 0.15, // "tiny bit" of darkening
		// Bloom settings for old webcam look
		bloomIntensity = 0.4, // moderate glow
		bloomRadius = 0.85, // spread of the bloom
		bloomThreshold = 0.85 // only bright areas bloom
	} = $props();

	let composer: EffectComposer | null = null;
	let dofEffect: DepthOfFieldEffect | null = null;
	let vignetteEffect: VignetteEffect | null = null;
	let bloomEffect: BloomEffect | null = null;
	let effectPass: EffectPass | null = null;

	function initializeComposer() {
		if (!renderer || !scene || !camera) return;

		// Get the actual camera instance from Threlte's reactive store
		const cameraInstance = camera.current;

		// Create effect composer
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, cameraInstance));

		// Initialize effects array
		const effects: any[] = [];

		// 1) Depth blur for far distances - exactly as specified
		if (enableDepthBlur) {
			dofEffect = new DepthOfFieldEffect(cameraInstance, {
				focusDistance, // focus close (so far plane gets blur)
				focalLength, // short lens; smaller = subtler blur transition
				bokehScale // tiny bokeh; keep < 1 for "just a hint"
			});
			effects.push(dofEffect);
		}

		// 2) Bloom effect for old webcam highlights
		if (enableBloom) {
			bloomEffect = new BloomEffect({
				intensity: bloomIntensity, // glow intensity
				radius: bloomRadius, // spread of the bloom
				luminanceThreshold: bloomThreshold, // only bright areas bloom
				luminanceSmoothing: 0.1 // smooth transition
			});
			effects.push(bloomEffect);
		}

		// 3) Tiny vignette
		if (enableVignette) {
			vignetteEffect = new VignetteEffect({
				eskil: false,
				offset: vignetteOffset, // start falloff near edges
				darkness: vignetteDarkness // "tiny bit" of darkening
			});
			effects.push(vignetteEffect);
		}

		// Only add effect pass if we have effects
		if (effects.length > 0) {
			effectPass = new EffectPass(cameraInstance, ...effects);
			composer.addPass(effectPass);
		}

		console.log('[PostProcessing] Effects initialized:', {
			depthBlur: enableDepthBlur,
			bloom: enableBloom,
			vignette: enableVignette
		});
	}

	// Function to focus on a specific object (as per your specification)
	export function setFocusToObject(obj: THREE.Object3D) {
		if (!dofEffect || !camera) return;

		// Distance from camera to object in meters
		const camPos = new THREE.Vector3();
		const objPos = new THREE.Vector3();
		camera.current.getWorldPosition(camPos);
		obj.getWorldPosition(objPos);
		const d = camPos.distanceTo(objPos);

		// Map to normalized [0..1] between camera.near and camera.far
		const cameraObj = camera.current as THREE.PerspectiveCamera;
		const fd = THREE.MathUtils.clamp(
			THREE.MathUtils.mapLinear(d, cameraObj.near, cameraObj.far, 0, 1),
			0,
			1
		);
		dofEffect.circleOfConfusionMaterial.uniforms.focusDistance.value = fd;
	}

	// Animation loop - exactly as you specified
	let animationId: number | null = null;

	function animate() {
		if (!composer) {
			animationId = globalThis.requestAnimationFrame(animate);
			return;
		}

		composer.render();
		animationId = globalThis.requestAnimationFrame(animate);
	}

	// Handle window resize
	function handleResize() {
		if (!composer || !renderer) return;
		
		const size = renderer.getSize(new THREE.Vector2());
		composer.setSize(size.x, size.y);
	}

	onMount(() => {
		initializeComposer();
		animationId = globalThis.requestAnimationFrame(animate);

		if (typeof globalThis.window !== 'undefined') {
			globalThis.window.addEventListener('resize', handleResize);
			return () => globalThis.window.removeEventListener('resize', handleResize);
		}
		return () => {};
	});

	onDestroy(() => {
		if (animationId) {
			globalThis.cancelAnimationFrame(animationId);
		}
		composer?.dispose();
	});

	// Reactive effects - rebuild composer when settings change
	$effect(() => {
		if (composer) {
			composer.dispose();
			initializeComposer();
		}
	});
</script>
