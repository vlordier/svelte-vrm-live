<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import OrbitController from './OrbitController.svelte';
	import SceneModel from './SceneModel.svelte';
	import PostProcessing from './PostProcessing.svelte';
	import PostProcessingControls from './PostProcessingControls.svelte';

	let { children } = $props();

	// Post-processing state
	let enableDepthBlur = $state(false);
	let enableVignette = $state(false);
	let enableBloom = $state(false);
	let focusDistance = $state(0.05);
	let focalLength = $state(0.02);
	let bokehScale = $state(0.85);
	let vignetteOffset = $state(0.3);
	let vignetteDarkness = $state(0.15);
	let bloomIntensity = $state(0.4);
	let bloomRadius = $state(0.85);
	let bloomThreshold = $state(0.85);
</script>

<div style="width: 100svw; height: 100svh;">
	<Canvas>
		<SceneModel />
		<T.PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50}>
			<OrbitController />
		</T.PerspectiveCamera>
		<T.AmbientLight intensity={1} />
		<PostProcessing
			{enableDepthBlur}
			{enableVignette}
			{enableBloom}
			{focusDistance}
			{focalLength}
			{bokehScale}
			{vignetteOffset}
			{vignetteDarkness}
			{bloomIntensity}
			{bloomRadius}
			{bloomThreshold}
		/>
		{@render children()}
	</Canvas>

	<!-- Post-processing controls -->
	<PostProcessingControls
		bind:enableDepthBlur
		bind:enableVignette
		bind:enableBloom
		bind:focusDistance
		bind:focalLength
		bind:bokehScale
		bind:vignetteOffset
		bind:vignetteDarkness
		bind:bloomIntensity
		bind:bloomRadius
		bind:bloomThreshold
	/>
</div>
