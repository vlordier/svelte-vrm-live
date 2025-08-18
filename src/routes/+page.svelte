<script lang="ts">
	import Scene from '$lib/components/Scene.svelte';
	import VRMAvatar from '$lib/components/VRMAvatar.svelte';
	import type { VRM } from '@pixiv/three-vrm';
	import Chat from '$lib/components/Chat.svelte';
	import type { AnimationController } from '$lib/animation/AnimationController.svelte';

	const avatarModelPath = '/models/punk.vrm'; // Ensure avatar.vrm is in static/models

	let vrmInstance = $state<VRM | null>(null);
	let animationController = $state<AnimationController | null>(null);
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
		<VRMAvatar modelPath={avatarModelPath} bind:vrm={vrmInstance} bind:animationController />
	</Scene>

	<Chat {vrmInstance} {animationController} />
</div>
