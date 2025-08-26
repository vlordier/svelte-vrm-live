import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// For now, return a simple HTTP endpoint since WebSocket setup varies by deployment
	// This can be upgraded to WebSocket when deployed to environments that support it
	return new Response(JSON.stringify({
		message: 'WebSocket status updates not available in this environment',
		alternative: 'Use /api/status endpoint with polling for real-time updates',
		polling_interval_ms: 5000
	}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};