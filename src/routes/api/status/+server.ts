import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ServiceStatusManager from '$lib/status/ServiceStatusManager';

let statusManager: ServiceStatusManager | null = null;

// Initialize the status manager once
function getStatusManager(): ServiceStatusManager {
	if (!statusManager) {
		statusManager = ServiceStatusManager.getInstance();
	}
	return statusManager;
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const manager = getStatusManager();
	manager.setFetch(fetch); // Set the SvelteKit fetch function
	const service = url.searchParams.get('service');
	
	try {
		if (service) {
			// Refresh specific service and return its status
			await manager.refreshService(service);
			const systemStatus = manager.getSystemStatus();
			const serviceStatus = systemStatus.services[service];
			
			if (!serviceStatus) {
				return json(
					{ error: `Service '${service}' not found` },
					{ status: 404 }
				);
			}
			
			return json({
				service: service,
				...serviceStatus,
				system_info: systemStatus.system_info
			});
		} else {
			// Return full system status
			const systemStatus = manager.getSystemStatus();
			return json(systemStatus);
		}
	} catch (error) {
		console.error('[Status API] Error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};

// Optional: Handle service-specific refreshes via POST
export const POST: RequestHandler = async ({ request }) => {
	const manager = getStatusManager();
	
	try {
		const { services } = await request.json();
		
		if (Array.isArray(services)) {
			// Refresh multiple services
			await Promise.allSettled(
				services.map((service: string) => manager.refreshService(service))
			);
		} else {
			// Refresh all services
			const systemStatus = manager.getSystemStatus();
			const allServices = Object.keys(systemStatus.services);
			await Promise.allSettled(
				allServices.map(service => manager.refreshService(service))
			);
		}
		
		return json({
			success: true,
			message: 'Status refresh completed',
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[Status API] Refresh error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};