import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { TTSCache } from '$lib/tts/cache';

export const POST: RequestHandler = async () => {
	try {
		// Clear Hugging Face transformers cache
		const hfCachePath = join(process.cwd(), 'node_modules/@huggingface/transformers/.cache');
		if (existsSync(hfCachePath)) {
			rmSync(hfCachePath, { recursive: true, force: true });
			console.log('[TTS Cache] Cleared Hugging Face transformers cache');
		}

		// Clear local Kokoro cache if it exists
		const kokoroCachePath = join(process.cwd(), '.kokoro-cache');
		if (existsSync(kokoroCachePath)) {
			rmSync(kokoroCachePath, { recursive: true, force: true });
			console.log('[TTS Cache] Cleared Kokoro local cache');
		}

		// Clear TTS cache (welcome messages)
		const ttsCachePath = join(process.cwd(), '.tts-cache');
		if (existsSync(ttsCachePath)) {
			rmSync(ttsCachePath, { recursive: true, force: true });
			console.log('[TTS Cache] Cleared welcome message cache');
		}

		// Also use the cache utility to clear
		TTSCache.clearCache();

		return json({
			success: true,
			message: 'TTS cache cleared successfully'
		});
	} catch (error) {
		console.error('Error clearing TTS cache:', error);
		return json(
			{
				success: false,
				message: `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
			},
			{ status: 500 }
		);
	}
};
