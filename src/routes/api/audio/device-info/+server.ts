import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// This endpoint returns minimal server-side info
	// The actual device detection happens client-side
	return json({
		message: 'Audio device detection must be performed client-side',
		serverInfo: {
			platform: process.platform,
			nodeVersion: process.version,
			audioSupport: 'Web Audio API only available in browsers'
		}
	});
};
