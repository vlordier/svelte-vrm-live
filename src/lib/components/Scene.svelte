<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import OrbitController from './OrbitController.svelte';
	import SceneModel from './SceneModel.svelte';
	import PostProcessing from './PostProcessing.svelte';

	let { children } = $props();
</script>

<div style="width: 100svw; height: 100svh;">
	<Canvas>
		<SceneModel />
		<T.PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50}>
			<OrbitController />
		</T.PerspectiveCamera>
		<T.AmbientLight intensity={1} />
		<PostProcessing />
		{@render children()}
	</Canvas>
</div>
