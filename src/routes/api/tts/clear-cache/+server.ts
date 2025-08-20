import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { TTSCache } from '$lib/tts/cache';
import { TTSCacheManager } from '$lib/tts/cache-manager';
import { env } from '$env/dynamic/private';
import { ttsProgressManager } from '$lib/tts/progress-manager';

export const POST: RequestHandler = async () => {
	try {
		console.log('[TTS Cache] Starting cache clearing process...');

		// Reset progress manager state
		ttsProgressManager.reset();
		ttsProgressManager.updateProgress({
			status: 'initializing',
			percentage: 0,
			message: 'Clearing cache...'
		});

		// Use our new cache manager to clear Kokoro model cache specifically
		const modelId = env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX';
		const kokoroCacheCleared = await TTSCacheManager.clearModelCache(modelId);

		// Clear Hugging Face transformers cache (fallback)
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

		console.log('[TTS Cache] Cache clearing completed');

		return json({
			success: true,
			message: kokoroCacheCleared
				? 'TTS cache cleared successfully - next TTS request will re-download model'
				: 'TTS cache partially cleared - some files may persist',
			kokoroCacheCleared
		});
	} catch (error) {
		console.error('Error clearing TTS cache:', error);

		// Update progress manager with error
		ttsProgressManager.updateProgress({
			status: 'error',
			percentage: 0,
			message: 'Failed to clear cache'
		});

		return json(
			{
				success: false,
				message: `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
			},
			{ status: 500 }
		);
	}
};
