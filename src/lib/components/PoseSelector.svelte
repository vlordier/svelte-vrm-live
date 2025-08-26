<script lang="ts">
	import { PoseCatalog } from '$lib/animation/PoseCatalog';
	import type { VRMAPose } from '$lib/animation/VRMALoader';
	import type { EnhancedAnimationController } from '$lib/animation/EnhancedAnimationController.svelte';

	let {
		animationController = $bindable<EnhancedAnimationController | null>(null),
		isVisible = $bindable(false)
	}: {
		animationController?: EnhancedAnimationController | null;
		isVisible?: boolean;
	} = $props();

	// State management
	let selectedCategory = $state('Solo Female');
	let searchQuery = $state('');
	let isLoading = $state(false);
	let currentPose = $state<VRMAPose | null>(null);

	// Get available categories
	const categories = PoseCatalog.getCategories();

	// Reactive filtered poses
	let filteredPoses = $derived(() => {
		if (searchQuery.trim()) {
			return PoseCatalog.searchPoses(searchQuery);
		}
		return PoseCatalog.getPosesByCategory(selectedCategory);
	});

	// Handle pose selection
	async function selectPose(pose: VRMAPose) {
		if (!animationController || isLoading) return;

		isLoading = true;
		try {
			console.log('[PoseSelector] Selecting pose:', pose.name);
			
			// Apply the pose directly for immediate posing
			const success = await animationController.applyPoseDirectly(pose);
			
			if (success) {
				currentPose = pose;
				console.log('[PoseSelector] Pose applied successfully:', pose.name);
			} else {
				console.error('[PoseSelector] Failed to apply pose:', pose.name);
			}
		} catch (error) {
			console.error('[PoseSelector] Error selecting pose:', error);
		} finally {
			isLoading = false;
		}
	}

	// Return to idle animation
	async function returnToIdle() {
		if (!animationController || isLoading) return;

		isLoading = true;
		try {
			await animationController.returnToIdle();
			currentPose = null;
		} catch (error) {
			console.error('[PoseSelector] Error returning to idle:', error);
		} finally {
			isLoading = false;
		}
	}

	// Clear search
	function clearSearch() {
		searchQuery = '';
	}

	// Get safe display name for pose
	function getSafeDisplayName(name: string): string {
		// Replace explicit terms with more neutral language for UI display
		return name
			.replace(/Cock/gi, 'Adult')
			.replace(/Penis/gi, 'Adult')
			.replace(/Anal/gi, 'Intimate');
	}

	// Get pose thumbnail if available (placeholder for now)
	function getPoseThumbnail(pose: VRMAPose): string {
		// In a real implementation, you might generate or provide thumbnail images
		return '/placeholder-pose.png';
	}
</script>

<!-- Pose Selector Modal/Panel -->
{#if isVisible}
	<div class="pose-selector-overlay" onclick={() => isVisible = false}>
		<div class="pose-selector-panel" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="selector-header">
				<h2>Animation & Pose Selector</h2>
				<button class="close-btn" onclick={() => isVisible = false}>×</button>
			</div>

			<!-- Current Status -->
			{#if currentPose}
				<div class="current-pose">
					<strong>Current Pose:</strong> {getSafeDisplayName(currentPose.name)}
					<button class="return-idle-btn" onclick={returnToIdle} disabled={isLoading}>
						Return to Idle
					</button>
				</div>
			{/if}

			<!-- Search Bar -->
			<div class="search-section">
				<div class="search-bar">
					<input
						type="text"
						placeholder="Search poses..."
						bind:value={searchQuery}
						class="search-input"
					/>
					{#if searchQuery}
						<button class="clear-search-btn" onclick={clearSearch}>Clear</button>
					{/if}
				</div>
			</div>

			<!-- Category Tabs -->
			{#if !searchQuery}
				<div class="category-tabs">
					{#each categories as category}
						<button
							class="category-tab {selectedCategory === category ? 'active' : ''}"
							onclick={() => selectedCategory = category}
						>
							{category}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Loading State -->
			{#if isLoading}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading pose...</p>
				</div>
			{/if}

			<!-- Poses Grid -->
			<div class="poses-grid">
				{#each filteredPoses as pose}
					<div class="pose-card {currentPose?.name === pose.name ? 'active' : ''}">
						<!-- Pose Thumbnail -->
						<div class="pose-thumbnail">
							<img src={getPoseThumbnail(pose)} alt={pose.name} loading="lazy" />
						</div>
						
						<!-- Pose Info -->
						<div class="pose-info">
							<h4 class="pose-name">{getSafeDisplayName(pose.name)}</h4>
							{#if pose.description}
								<p class="pose-description">{pose.description}</p>
							{/if}
							
							<!-- Props indicator -->
							{#if pose.props && pose.props.length > 0}
								<div class="pose-props">
									<small>Props: {pose.props.length}</small>
								</div>
							{/if}
							
							<!-- Category badge -->
							<div class="pose-category">
								<small>{pose.category}</small>
							</div>
						</div>

						<!-- Select Button -->
						<button
							class="select-pose-btn"
							onclick={() => selectPose(pose)}
							disabled={isLoading}
						>
							{currentPose?.name === pose.name ? 'Active' : 'Select'}
						</button>
					</div>
				{/each}
			</div>

			<!-- No Results -->
			{#if filteredPoses.length === 0}
				<div class="no-results">
					<p>No poses found {searchQuery ? `for "${searchQuery}"` : `in ${selectedCategory}`}</p>
				</div>
			{/if}

			<!-- Footer Info -->
			<div class="selector-footer">
				<p class="info-text">
					<strong>Note:</strong> Adult content - 18+ only. Poses include realistic anatomy and mature themes.
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.pose-selector-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.pose-selector-panel {
		background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
		border-radius: 16px;
		padding: 24px;
		max-width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 16px;
	}

	.selector-header h2 {
		color: #fff;
		font-size: 1.5rem;
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: #fff;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background 0.2s;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.current-pose {
		background: rgba(0, 255, 0, 0.1);
		border: 1px solid rgba(0, 255, 0, 0.3);
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 16px;
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.return-idle-btn {
		background: rgba(255, 100, 100, 0.8);
		border: none;
		border-radius: 6px;
		color: white;
		padding: 6px 12px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
	}

	.return-idle-btn:hover:not(:disabled) {
		background: rgba(255, 100, 100, 1);
	}

	.return-idle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.search-section {
		margin-bottom: 20px;
	}

	.search-bar {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.search-input {
		flex: 1;
		padding: 12px 16px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.3);
		color: #fff;
		font-size: 1rem;
	}

	.search-input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}

	.clear-search-btn {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 6px;
		color: #fff;
		padding: 8px 12px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.clear-search-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.category-tabs {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}

	.category-tab {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 20px;
		color: #fff;
		padding: 8px 16px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.9rem;
	}

	.category-tab:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.category-tab.active {
		background: rgba(138, 43, 226, 0.8);
		color: white;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: #fff;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top: 3px solid #8a2be2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.poses-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
		margin-bottom: 20px;
	}

	.pose-card {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 16px;
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.pose-card:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(138, 43, 226, 0.5);
		transform: translateY(-2px);
	}

	.pose-card.active {
		background: rgba(138, 43, 226, 0.2);
		border-color: rgba(138, 43, 226, 0.8);
	}

	.pose-thumbnail {
		width: 100%;
		height: 160px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pose-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pose-info {
		margin-bottom: 12px;
	}

	.pose-name {
		color: #fff;
		margin: 0 0 8px 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.pose-description {
		color: rgba(255, 255, 255, 0.7);
		margin: 0 0 8px 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.pose-props {
		color: rgba(100, 200, 255, 0.8);
		margin-bottom: 4px;
	}

	.pose-category {
		color: rgba(138, 43, 226, 0.8);
		font-weight: 500;
	}

	.select-pose-btn {
		width: 100%;
		background: linear-gradient(145deg, rgba(138, 43, 226, 0.8), rgba(138, 43, 226, 0.6));
		border: none;
		border-radius: 8px;
		color: white;
		padding: 10px;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.2s;
	}

	.select-pose-btn:hover:not(:disabled) {
		background: linear-gradient(145deg, rgba(138, 43, 226, 1), rgba(138, 43, 226, 0.8));
		transform: translateY(-1px);
	}

	.select-pose-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.no-results {
		text-align: center;
		padding: 40px;
		color: rgba(255, 255, 255, 0.6);
	}

	.selector-footer {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 16px;
		margin-top: 20px;
	}

	.info-text {
		color: rgba(255, 200, 100, 0.8);
		font-size: 0.9rem;
		text-align: center;
		margin: 0;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.pose-selector-panel {
			width: 95vw;
			height: 95vh;
			padding: 16px;
		}

		.poses-grid {
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			gap: 12px;
		}

		.category-tabs {
			gap: 6px;
		}

		.category-tab {
			padding: 6px 12px;
			font-size: 0.8rem;
		}
	}
</style>