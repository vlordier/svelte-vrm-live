import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TTSCache } from '$lib/tts/cache';

export const GET: RequestHandler = async () => {
	try {
		const stats = TTSCache.getCacheStats();

		return json({
			success: true,
			cache: {
				welcomeMessages: stats.count,
				totalSize: stats.totalSize,
				entries: stats.entries,
				sizeFormatted: formatBytes(stats.totalSize)
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				message: `Failed to get cache info: ${error instanceof Error ? error.message : 'Unknown error'}`,
				cache: {
					welcomeMessages: 0,
					totalSize: 0,
					entries: [],
					sizeFormatted: '0 B'
				}
			},
			{ status: 500 }
		);
	}
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
