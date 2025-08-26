<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Environment, OrbitControls } from '@threlte/extras';
	import { type VRM } from '@pixiv/three-vrm';
	import EnhancedVRMAvatar from './EnhancedVRMAvatar.svelte';
	import PoseSelector from './PoseSelector.svelte';
	import type { EnhancedAnimationController } from '$lib/animation/EnhancedAnimationController.svelte';

	// State management
	let vrm = $state<VRM | null>(null);
	let animationController = $state<EnhancedAnimationController | null>(null);
	let showPoseSelector = $state(false);
	let selectedModelPath = $state('/models/cali_girl2.vrm');

	// Available VRM models
	const availableModels = [
		{ name: 'Cali Girl 2', path: '/models/cali_girl2.vrm' },
		{ name: 'Default Avatar', path: '/models/avatar.vrm' }
	];

	// Debug functions
	function logAnimationStatus() {
		if (animationController) {
			const state = animationController.getCurrentState();
			const pose = animationController.getCurrentPose();
			console.log('[AnimationTestScene] Animation Status:', {
				state,
				currentPose: pose?.name || 'none',
				posesAvailable: Object.keys(animationController.getAvailablePoses()).length
			});
		} else {
			console.log('[AnimationTestScene] Animation controller not initialized');
		}
	}

	function testRandomPose() {
		if (animationController) {
			const allPoses = Object.values(animationController.getAvailablePoses()).flat();
			if (allPoses.length > 0) {
				const randomPose = allPoses[Math.floor(Math.random() * allPoses.length)];
				console.log('[AnimationTestScene] Testing random pose:', randomPose.name);
				animationController.applyPoseDirectly(randomPose);
			}
		}
	}

	function returnToIdle() {
		if (animationController) {
			animationController.returnToIdle();
		}
	}

	// Expose functions globally for console testing
	if (typeof window !== 'undefined') {
		(window as any).testAnimationSystem = {
			logStatus: logAnimationStatus,
			testRandomPose,
			returnToIdle,
			showPoseSelector: () => showPoseSelector = true,
			hidePoseSelector: () => showPoseSelector = false
		};
	}
</script>

<div class="animation-test-container">
	<!-- Control Panel -->
	<div class="control-panel">
		<h2>VRM Animation Test Scene</h2>
		
		<!-- Model Selection -->
		<div class="control-group">
			<label>VRM Model:</label>
			<select bind:value={selectedModelPath}>
				{#each availableModels as model}
					<option value={model.path}>{model.name}</option>
				{/each}
			</select>
		</div>

		<!-- Animation Controls -->
		<div class="control-group">
			<label>Animation Controls:</label>
			<div class="button-group">
				<button onclick={() => showPoseSelector = true} disabled={!animationController}>
					Open Pose Selector
				</button>
				<button onclick={testRandomPose} disabled={!animationController}>
					Random Pose
				</button>
				<button onclick={returnToIdle} disabled={!animationController}>
					Return to Idle
				</button>
			</div>
		</div>

		<!-- Debug Controls -->
		<div class="control-group">
			<label>Debug:</label>
			<div class="button-group">
				<button onclick={logAnimationStatus}>Log Status</button>
			</div>
		</div>

		<!-- Status Display -->
		{#if animationController}
			<div class="status-display">
				<h3>Status</h3>
				<p><strong>State:</strong> {animationController.getCurrentState()}</p>
				<p><strong>Current Pose:</strong> {animationController.getCurrentPose()?.name || 'None'}</p>
				<p><strong>Available Categories:</strong> {Object.keys(animationController.getAvailablePoses()).join(', ')}</p>
			</div>
		{:else}
			<div class="status-display">
				<p>Loading animation system...</p>
			</div>
		{/if}
	</div>

	<!-- 3D Scene -->
	<div class="scene-container">
		<Canvas>
			<!-- Environment and Controls -->
			<Environment path="/hdri/" files="studio_small_09_1k.hdr" />
			<OrbitControls enableDamping target={[0, 0, -2]} />

			<!-- Enhanced VRM Avatar with Pose System -->
			<EnhancedVRMAvatar 
				modelPath={selectedModelPath}
				bind:vrm
				bind:animationController
				enablePoseSystem={true}
			/>

			<!-- Lighting -->
			<ambientLight intensity={0.6} />
			<directionalLight 
				position={[10, 10, 5]} 
				intensity={1} 
				castShadow 
			/>
		</Canvas>
	</div>

	<!-- Pose Selector Modal -->
	<PoseSelector 
		bind:isVisible={showPoseSelector}
		bind:animationController
	/>
</div>

<style>
	.animation-test-container {
		display: flex;
		height: 100vh;
		width: 100vw;
		background: #1a1a1a;
		color: white;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.control-panel {
		width: 320px;
		padding: 20px;
		background: linear-gradient(145deg, #222, #333);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		overflow-y: auto;
	}

	.control-panel h2 {
		margin-top: 0;
		color: #8a2be2;
		font-size: 1.3rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		padding-bottom: 10px;
		margin-bottom: 20px;
	}

	.control-group {
		margin-bottom: 24px;
	}

	.control-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
		color: #ddd;
	}

	.control-group select {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.3);
		color: white;
		font-size: 1rem;
	}

	.button-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.button-group button {
		padding: 10px 16px;
		border: none;
		border-radius: 6px;
		background: linear-gradient(145deg, #8a2be2, #6a1b9a);
		color: white;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.button-group button:hover:not(:disabled) {
		background: linear-gradient(145deg, #9a3bf2, #7a2baa);
		transform: translateY(-1px);
	}

	.button-group button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.status-display {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 16px;
	}

	.status-display h3 {
		margin: 0 0 12px 0;
		color: #8a2be2;
		font-size: 1.1rem;
	}

	.status-display p {
		margin: 6px 0;
		font-size: 0.9rem;
		color: #ccc;
	}

	.scene-container {
		flex: 1;
		position: relative;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.animation-test-container {
			flex-direction: column;
		}

		.control-panel {
			width: 100%;
			height: 200px;
			padding: 16px;
		}

		.button-group {
			flex-direction: row;
			flex-wrap: wrap;
		}

		.scene-container {
			height: calc(100vh - 200px);
		}
	}
</style>