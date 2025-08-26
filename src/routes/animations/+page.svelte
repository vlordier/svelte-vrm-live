<script lang="ts">
	import AnimationTestScene from '$lib/components/AnimationTestScene.svelte';
	import { onMount } from 'svelte';

	let mounted = false;

	onMount(() => {
		mounted = true;
		
		// Log instructions to console
		console.log('%c🎭 VRM Animation System Test Page', 'color: #8a2be2; font-size: 16px; font-weight: bold;');
		console.log('Available console commands:');
		console.log('- testAnimationSystem.logStatus() - Log current animation status');
		console.log('- testAnimationSystem.testRandomPose() - Apply a random pose');
		console.log('- testAnimationSystem.returnToIdle() - Return to idle animation');
		console.log('- testAnimationSystem.showPoseSelector() - Open pose selector UI');
		console.log('- logVRMPoseStatus() - Log detailed pose system status');
	});
</script>

<svelte:head>
	<title>VRM Animation System Test</title>
	<meta name="description" content="Test page for VRM Animation System with VRMA pose integration" />
</svelte:head>

{#if mounted}
	<AnimationTestScene />
{:else}
	<div class="loading-screen">
		<div class="loading-content">
			<div class="spinner"></div>
			<h1>Loading VRM Animation System</h1>
			<p>Initializing 3D scene and animation controls...</p>
		</div>
	</div>
{/if}

<style>
	.loading-screen {
		width: 100vw;
		height: 100vh;
		background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.loading-content {
		text-align: center;
	}

	.spinner {
		width: 60px;
		height: 60px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-top: 4px solid #8a2be2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 20px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.loading-content h1 {
		color: #8a2be2;
		margin-bottom: 12px;
		font-size: 1.8rem;
	}

	.loading-content p {
		color: #ccc;
		font-size: 1rem;
	}
</style>