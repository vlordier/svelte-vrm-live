<script lang="ts">
	let {
		enableDepthBlur = $bindable(false),
		enableVignette = $bindable(false),
		enableBloom = $bindable(false),
		focusDistance = $bindable(0.05),
		focalLength = $bindable(0.02),
		bokehScale = $bindable(0.85),
		vignetteOffset = $bindable(0.3),
		vignetteDarkness = $bindable(0.15),
		bloomIntensity = $bindable(0.4),
		bloomRadius = $bindable(0.85),
		bloomThreshold = $bindable(0.85)
	} = $props();

	let showControls = $state(false);
</script>

<!-- Toggle button -->
<button class="toggle-btn" onclick={() => (showControls = !showControls)}>
	🎛️ Post-FX
</button>

{#if showControls}
	<div class="controls-panel">
		<h3>Post-Processing Effects</h3>

		<!-- Depth Blur Controls -->
		<div class="effect-section">
			<label class="control-group">
				<input type="checkbox" bind:checked={enableDepthBlur} />
				<strong>Depth Blur (Far-Only)</strong>
			</label>

			{#if enableDepthBlur}
				<div class="effect-params">
					<label class="control-group">
						Focus Distance: {focusDistance.toFixed(3)}
						<input type="range" min="0.01" max="0.2" step="0.005" bind:value={focusDistance} />
						<small>Lower = closer focus, more background blur</small>
					</label>

					<label class="control-group">
						Focal Length: {focalLength.toFixed(3)}
						<input type="range" min="0.01" max="0.05" step="0.001" bind:value={focalLength} />
						<small>Lower = subtler blur transition</small>
					</label>

					<label class="control-group">
						Bokeh Scale: {bokehScale.toFixed(2)}
						<input type="range" min="0.3" max="1.0" step="0.05" bind:value={bokehScale} />
						<small>Keep &lt; 1 for subtle bokeh</small>
					</label>
				</div>
			{/if}
		</div>

		<!-- Vignette Controls -->
		<div class="effect-section">
			<label class="control-group">
				<input type="checkbox" bind:checked={enableVignette} />
				<strong>Vignette</strong>
			</label>

			{#if enableVignette}
				<div class="effect-params">
					<label class="control-group">
						Offset: {vignetteOffset.toFixed(2)}
						<input type="range" min="0.1" max="0.5" step="0.05" bind:value={vignetteOffset} />
						<small>Where edge darkening starts</small>
					</label>

					<label class="control-group">
						Darkness: {vignetteDarkness.toFixed(2)}
						<input type="range" min="0.05" max="0.3" step="0.01" bind:value={vignetteDarkness} />
						<small>Keep ≤ 0.2 for subtlety</small>
					</label>
				</div>
			{/if}
		</div>

		<!-- Bloom Controls -->
		<div class="effect-section">
			<label class="control-group">
				<input type="checkbox" bind:checked={enableBloom} />
				<strong>Bloom (Old Webcam Highlights)</strong>
			</label>

			{#if enableBloom}
				<div class="effect-params">
					<label class="control-group">
						Intensity: {bloomIntensity.toFixed(2)}
						<input type="range" min="0.1" max="1.0" step="0.05" bind:value={bloomIntensity} />
						<small>Glow intensity</small>
					</label>

					<label class="control-group">
						Radius: {bloomRadius.toFixed(2)}
						<input type="range" min="0.4" max="1.0" step="0.05" bind:value={bloomRadius} />
						<small>Bloom spread</small>
					</label>

					<label class="control-group">
						Threshold: {bloomThreshold.toFixed(2)}
						<input type="range" min="0.5" max="1.0" step="0.05" bind:value={bloomThreshold} />
						<small>Only bright areas bloom</small>
					</label>
				</div>
			{/if}
		</div>

		<!-- Quick Presets -->
		<div class="presets">
			<h4>Quick Presets</h4>
			<button onclick={() => {
				enableDepthBlur = false;
				enableVignette = false;
				enableBloom = false;
			}}>No Effects</button>

			<button onclick={() => {
				enableVignette = true;
				vignetteOffset = 0.3;
				vignetteDarkness = 0.15;
				enableDepthBlur = false;
				enableBloom = false;
			}}>Vignette Only</button>

			<button onclick={() => {
				enableBloom = true;
				bloomIntensity = 0.4;
				bloomRadius = 0.85;
				bloomThreshold = 0.85;
				enableDepthBlur = false;
				enableVignette = false;
			}}>Old Webcam Bloom</button>

			<button onclick={() => {
				enableDepthBlur = true;
				focusDistance = 0.05;
				focalLength = 0.02;
				bokehScale = 0.85;
				enableVignette = true;
				vignetteOffset = 0.3;
				vignetteDarkness = 0.15;
				enableBloom = false;
			}}>Depth + Vignette</button>

			<button onclick={() => {
				enableBloom = true;
				bloomIntensity = 0.4;
				bloomRadius = 0.85;
				bloomThreshold = 0.85;
				enableVignette = true;
				vignetteOffset = 0.3;
				vignetteDarkness = 0.15;
				enableDepthBlur = false;
			}}>Old Webcam (Bloom + Vignette)</button>
		</div>
	</div>
{/if}

<style>
	.toggle-btn {
		position: fixed;
		top: 10px;
		right: 10px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		border: 1px solid #444;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		z-index: 1000;
		font-family: system-ui, sans-serif;
		font-size: 12px;
	}

	.toggle-btn:hover {
		background: rgba(0, 0, 0, 0.9);
	}

	.controls-panel {
		position: fixed;
		top: 50px;
		right: 10px;
		background: rgba(0, 0, 0, 0.95);
		color: white;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 16px;
		font-family: system-ui, sans-serif;
		font-size: 12px;
		z-index: 1000;
		min-width: 300px;
		max-height: 80vh;
		overflow-y: auto;
	}

	.controls-panel h3 {
		margin: 0 0 16px 0;
		font-size: 14px;
		color: #fff;
	}

	.controls-panel h4 {
		margin: 16px 0 8px 0;
		font-size: 12px;
		color: #ccc;
	}

	.effect-section {
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px solid #333;
	}

	.effect-params {
		margin-left: 20px;
		margin-top: 12px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 12px;
		gap: 4px;
	}

	.control-group input[type='range'] {
		width: 100%;
		margin: 4px 0;
	}

	.control-group input[type='checkbox'] {
		width: auto;
		margin-right: 8px;
	}

	.control-group small {
		color: #999;
		font-size: 10px;
		font-style: italic;
	}

	.presets {
		border-top: 1px solid #333;
		padding-top: 16px;
	}

	.presets button {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 1px solid #555;
		padding: 6px 12px;
		margin: 4px 4px 4px 0;
		border-radius: 3px;
		cursor: pointer;
		font-size: 11px;
	}

	.presets button:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>