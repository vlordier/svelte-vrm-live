<script lang="ts">
	import Scene from '$lib/components/Scene.svelte';
	import VRMAvatar from '$lib/components/VRMAvatar.svelte';
	import type { VRM } from '@pixiv/three-vrm';
	import Chat from '$lib/components/Chat.svelte';
	import type { AnimationController } from '$lib/animation/AnimationController.svelte';
	import { onMount } from 'svelte';

	let avatarModelPath = $state<string | null>(null); // Start with null, wait for API
	let vrmInstance = $state<VRM | null>(null);
	let animationController = $state<AnimationController | null>(null);

	onMount(async () => {
		try {
			console.log('[Page] Fetching VRM config from API...');
			const response = await fetch('/api/config');
			const config = await response.json();
			console.log('[Page] VRM config received:', config);
			avatarModelPath = config.vrmModel;
			console.log('[Page] Avatar model path set to:', avatarModelPath);
		} catch (error) {
			console.error('[Page] Failed to load VRM config, using default punk.vrm:', error);
			// Fallback to default if API fails
			avatarModelPath = '/models/punk.vrm';
		}
	});
</script>

<svelte:head>
	<title>VRM Live - Interactive 3D Avatar Chat</title>
	<meta
		name="description"
		content="Interactive 3D VRM avatar with AI-powered chat, TTS, and realistic animations"
	/>
</svelte:head>

<div class="min-h-screen flex-1 items-center justify-center bg-gray-800 text-white">
	<Scene>
		{#if avatarModelPath}
			<VRMAvatar modelPath={avatarModelPath} bind:vrm={vrmInstance} bind:animationController />
		{:else}
			<!-- Loading state while waiting for VRM config -->
			<div class="flex items-center justify-center text-white">
				<p>Loading avatar configuration...</p>
			</div>
		{/if}
	</Scene>

	<Chat {vrmInstance} {animationController} />
</div>
