import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UnifiedTTSClient, type TTSProvider } from '$lib/tts/client';
import { KokoroTTSClient } from '$lib/tts/kokoro';
import { env } from '$env/dynamic/private';
import { ttsProgressManager } from '$lib/tts/progress-manager';

export const GET: RequestHandler = async () => {
	const ttsProvider = (env.TTS_PROVIDER || 'kokoro') as TTSProvider;

	try {
		let status: 'ready' | 'downloading' | 'error' | 'initializing' | 'retrying' = 'initializing';
		let message = 'Checking TTS status...';
		let provider = ttsProvider;
		let modelInfo = null;
		let progress = 0;

		// Check current progress from progress manager first
		const currentProgress = ttsProgressManager.getCurrentProgress();
		if (currentProgress.status !== 'initializing') {
			status = currentProgress.status;
			message = currentProgress.message || message;
			progress = currentProgress.percentage;
		}

		if (provider === 'kokoro') {
			// If progress manager already shows ready/error/downloading, use that info
			if (currentProgress.status === 'ready') {
				status = 'ready';
				message = 'Kokoro TTS model loaded and ready';
				modelInfo = {
					modelId: env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX',
					voice: env.KOKORO_VOICE || 'af_bella',
					dtype: env.KOKORO_DTYPE || 'q4',
					device: env.KOKORO_DEVICE || 'wasm'
				};
			} else if (currentProgress.status === 'downloading') {
				// Return current download progress
				status = 'downloading';
				message = currentProgress.message || 'Downloading model weights...';
				progress = currentProgress.percentage;
			} else if (currentProgress.status === 'retrying') {
				// Return current retry progress
				status = 'retrying';
				message = currentProgress.message || 'Retrying download...';
				progress = currentProgress.percentage;
			} else if (currentProgress.status === 'error') {
				// Return current error status
				status = 'error';
				message = currentProgress.message || 'TTS initialization failed';
			} else {
				// Only test initialization if we don't have current status info
				try {
					// Test if we can initialize Kokoro TTS
					const kokoroClient = new KokoroTTSClient({
						voice: (env.KOKORO_VOICE || 'af_bella') as any,
						modelId: env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX',
						dtype: (env.KOKORO_DTYPE || 'q4') as any,
						device: (env.KOKORO_DEVICE || 'wasm') as any
					});

					// Try a quick synthesis to check if model is ready
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const _testResult = await Promise.race([
						kokoroClient.synthesize('Test'),
						new Promise((_, reject) =>
							setTimeout(() => reject(new Error('Initialization timeout')), 30000)
						)
					]);

					await kokoroClient.dispose();

					status = 'ready';
					message = 'Kokoro TTS model loaded and ready';
					modelInfo = {
						modelId: env.KOKORO_MODEL_ID || 'onnx-community/Kokoro-82M-ONNX',
						voice: env.KOKORO_VOICE || 'af_bella',
						dtype: env.KOKORO_DTYPE || 'q4',
						device: env.KOKORO_DEVICE || 'wasm'
					};
				} catch (error) {
					// Check if it's a downloading/initialization error
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';

					if (errorMessage.includes('timeout') || errorMessage.includes('Initialization timeout')) {
						status = 'downloading';
						message =
							'Model weights are being downloaded. This may take a few minutes on first run.';
						progress = 50; // Assume we're halfway through if we timeout
					} else if (errorMessage.includes('download') || errorMessage.includes('fetch')) {
						status = 'downloading';
						message = 'Downloading model weights...';
						progress = 25;
					} else if (errorMessage.includes('Protobuf parsing failed')) {
						status = 'error';
						message = 'Model file corrupted. Clear cache and retry.';
					} else {
						status = 'error';
						message = `Kokoro TTS initialization failed: ${errorMessage}`;
					}
				}
			}
		} else if (provider === 'browser') {
			// Browser TTS is always ready if speechSynthesis is available
			status = 'ready';
			message = 'Browser TTS ready';
			modelInfo = {
				provider: 'browser',
				voices: 'Native browser voices'
			};
		}

		return json({
			status,
			message,
			provider,
			modelInfo,
			progress,
			availableProviders: UnifiedTTSClient.getProviderInfo()
		});
	} catch (error) {
		return json(
			{
				status: 'error',
				message: `TTS status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				provider: ttsProvider,
				modelInfo: null,
				availableProviders: UnifiedTTSClient.getProviderInfo()
			},
			{ status: 500 }
		);
	}
};
