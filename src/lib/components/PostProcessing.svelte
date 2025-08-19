<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { EffectComposer, RenderPass, EffectPass } from 'postprocessing';
	import { DepthOfFieldEffect, VignetteEffect } from 'postprocessing';
	import * as THREE from 'three';

	const { scene, camera, renderer } = useThrelte();

	let composer: EffectComposer | null = null;
	let dof: DepthOfFieldEffect | null = null;

	onMount(() => {
		if (!renderer || !scene || !camera) return;

		// Get the actual camera instance from Threlte's reactive store
		const cameraInstance = camera.current;

		// Create effect composer
		composer = new EffectComposer(renderer);
		composer.addPass(new RenderPass(scene, cameraInstance));

		// 1) Slight depth blur for far distances - keep focus near your subject
		dof = new DepthOfFieldEffect(cameraInstance, {
			focusDistance: 0.05, // focus close (so far plane gets blur)
			focalLength: 0.02, // short lens; smaller = subtler blur transition
			bokehScale: 0.85 // tiny bokeh; keep < 1 for "just a hint"
		});

		const vignette = new VignetteEffect({
			eskil: false,
			offset: 0.3, // start falloff near edges
			darkness: 0.15 // "tiny bit" of darkening
		});

		composer.addPass(new EffectPass(cameraInstance, dof, vignette));

		console.log('[PostProcessing] Minimal depth blur + vignette initialized');
	});

	// Animation loop
	let animationId: number | null = null;

	function animate() {
		if (!composer) {
			animationId = globalThis.requestAnimationFrame(animate);
			return;
		}

		composer.render();
		animationId = globalThis.requestAnimationFrame(animate);
	}

	onMount(() => {
		animationId = globalThis.requestAnimationFrame(animate);
	});

	onDestroy(() => {
		if (animationId) {
			globalThis.cancelAnimationFrame(animationId);
		}
		composer?.dispose();
	});

	// Function to focus on a specific object (optional utility)
	export function setFocusToObject(obj: THREE.Object3D) {
		if (!dof || !camera) return;

		// Distance from camera to object in meters
		const camPos = new THREE.Vector3();
		const objPos = new THREE.Vector3();
		camera.current.getWorldPosition(camPos);
		obj.getWorldPosition(objPos);
		const d = camPos.distanceTo(objPos);

		// Map to normalized [0..1] between camera.near and camera.far
		const fd = THREE.MathUtils.clamp(
			THREE.MathUtils.mapLinear(d, camera.current.near, camera.current.far, 0, 1),
			0,
			1
		);
		dof.circleOfConfusionMaterial.uniforms.focusDistance.value = fd;
	}
</script>
