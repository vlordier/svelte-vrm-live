<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { SystemStatus } from '$lib/status/ServiceStatusManager';

	let systemStatus: SystemStatus | null = null;
	let loading = true;
	let error: string | null = null;
	let refreshInterval: number | null = null;

	const statusColors = {
		ready: '#22c55e',
		loading: '#eab308',
		downloading: '#3b82f6',
		initializing: '#6b7280',
		error: '#ef4444',
		offline: '#64748b'
	};

	const statusLabels = {
		ready: 'Ready',
		loading: 'Loading',
		downloading: 'Downloading',
		initializing: 'Initializing',
		error: 'Error',
		offline: 'Offline'
	};

	async function fetchStatus() {
		try {
			const response = await fetch('/api/status');
			if (response.ok) {
				systemStatus = await response.json();
				error = null;
			} else {
				throw new Error(`HTTP ${response.status}`);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch status';
			console.error('Status fetch error:', err);
		} finally {
			loading = false;
		}
	}

	async function refreshService(serviceName: string) {
		try {
			await fetch(`/api/status?service=${serviceName}`);
			await fetchStatus(); // Refresh full status
		} catch (err) {
			console.error('Service refresh error:', err);
		}
	}

	function formatMemory(mb: number): string {
		if (mb < 1024) return `${mb}MB`;
		return `${(mb / 1024).toFixed(1)}GB`;
	}

	function getHealthColor(health: string): string {
		switch (health) {
			case 'healthy': return '#22c55e';
			case 'degraded': return '#eab308';
			case 'unhealthy': return '#ef4444';
			default: return '#64748b';
		}
	}

	onMount(() => {
		fetchStatus();
		// Auto-refresh every 5 seconds
		refreshInterval = globalThis.setInterval(fetchStatus, 5000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			globalThis.clearInterval(refreshInterval);
		}
	});
</script>

<div class="status-dashboard">
	<div class="dashboard-header">
		<h2>System Status</h2>
		{#if systemStatus}
			<div class="overall-health" style="color: {getHealthColor(systemStatus.overall_health)}">
				<span class="health-indicator" style="background-color: {getHealthColor(systemStatus.overall_health)}"></span>
				{systemStatus.overall_health.toUpperCase()}
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="loading">Loading system status...</div>
	{:else if error}
		<div class="error">Error: {error}</div>
	{:else if systemStatus}
		<!-- System Information -->
		<div class="system-info">
			<h3>System Information</h3>
			<div class="info-grid">
				<div class="info-item">
					<label>Platform:</label>
					<span>{systemStatus.system_info.platform}</span>
				</div>
				<div class="info-item">
					<label>Architecture:</label>
					<span>{systemStatus.system_info.arch}</span>
				</div>
				{#if systemStatus.system_info.memory_total > 0}
					<div class="info-item">
						<label>Memory:</label>
						<span>{formatMemory(systemStatus.system_info.memory_free)} / {formatMemory(systemStatus.system_info.memory_total)} free</span>
					</div>
				{/if}
				<div class="info-item">
					<label>Last Updated:</label>
					<span>{new Date(systemStatus.timestamp).toLocaleTimeString()}</span>
				</div>
			</div>
		</div>

		<!-- Services -->
		<div class="services">
			<h3>Services</h3>
			<div class="services-grid">
				{#each Object.entries(systemStatus.services) as [name, service] (name)}
					<div class="service-card">
						<div class="service-header">
							<h4>{service.name.toUpperCase()}</h4>
							<div class="service-status" style="color: {statusColors[service.status]}">
								<span class="status-indicator" style="background-color: {statusColors[service.status]}"></span>
								{statusLabels[service.status]}
							</div>
						</div>
						
						<div class="service-details">
							{#if service.message}
								<p class="service-message">{service.message}</p>
							{/if}
							
							{#if service.progress !== undefined && service.progress > 0}
								<div class="progress-bar">
									<div class="progress-fill" style="width: {service.progress}%"></div>
								</div>
								<div class="progress-text">{service.progress}%</div>
							{/if}

							{#if service.model_info}
								<div class="model-info">
									<div class="model-item">
										<label>Model:</label>
										<span>{service.model_info.name}</span>
									</div>
									{#if service.model_info.version}
										<div class="model-item">
											<label>Version:</label>
											<span>{service.model_info.version}</span>
										</div>
									{/if}
									{#if service.model_info.size}
										<div class="model-item">
											<label>Size:</label>
											<span>{service.model_info.size}</span>
										</div>
									{/if}
								</div>
							{/if}

							{#if service.device}
								<div class="device-info">
									<label>Device:</label>
									<span class="device-badge" class:gpu={service.device.includes('gpu') || service.device === 'cuda' || service.device === 'mps'}>
										{service.device.toUpperCase()}
									</span>
								</div>
							{/if}

							{#if service.memory_usage}
								<div class="memory-info">
									<label>Memory:</label>
									<span>{formatMemory(service.memory_usage.allocated)} allocated</span>
								</div>
							{/if}
						</div>

						<button class="refresh-btn" on:click={() => refreshService(name)}>
							Refresh
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.status-dashboard {
		padding: 1rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.overall-health {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: bold;
		font-size: 1.1rem;
	}

	.health-indicator, .status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.loading, .error {
		text-align: center;
		padding: 2rem;
		font-size: 1.1rem;
	}

	.error {
		color: #ef4444;
	}

	.system-info {
		background: #f8fafc;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.info-item {
		display: flex;
		gap: 0.5rem;
	}

	.info-item label {
		font-weight: bold;
		min-width: 80px;
	}

	.services-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}

	.service-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
		position: relative;
	}

	.service-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.service-header h4 {
		margin: 0;
		font-size: 1rem;
	}

	.service-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: bold;
	}

	.service-message {
		margin: 0.5rem 0;
		font-size: 0.875rem;
		color: #64748b;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: #e2e8f0;
		border-radius: 4px;
		overflow: hidden;
		margin: 0.5rem 0;
	}

	.progress-fill {
		height: 100%;
		background: #3b82f6;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.875rem;
		color: #64748b;
		text-align: center;
	}

	.model-info, .device-info, .memory-info {
		margin: 0.5rem 0;
		font-size: 0.875rem;
	}

	.model-item {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.model-item label {
		font-weight: bold;
		min-width: 60px;
	}

	.device-badge {
		background: #f1f5f9;
		padding: 0.125rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.device-badge.gpu {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.refresh-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.refresh-btn:hover {
		background: #e2e8f0;
	}
</style>