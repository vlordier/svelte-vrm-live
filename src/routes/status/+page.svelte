<script lang="ts">
	import StatusDashboard from '$lib/components/StatusDashboard.svelte';
</script>

<svelte:head>
	<title>System Status - VRM Live</title>
</svelte:head>

<div class="status-page">
	<StatusDashboard />
</div>

<style>
	.status-page {
		min-height: 100vh;
		background: #f8fafc;
		padding: 2rem 0;
	}
</style>