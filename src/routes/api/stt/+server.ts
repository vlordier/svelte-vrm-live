import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UnifiedSTTClient } from '$lib/stt/client';
import { WhisperClient } from '$lib/stt/whisper';

export const GET: RequestHandler = async ({ url }) => {
	const action = url.searchParams.get('action');

	try {
		switch (action) {
			case 'info':
				return json({
					success: true,
					data: UnifiedSTTClient.getProviderInfo()
				});

			case 'models':
				return json({
					success: true,
					data: WhisperClient.getAvailableModels()
				});

			default:
				return json(
					{
						success: false,
						message: 'Invalid action. Available actions: info, models'
					},
					{ status: 400 }
				);
		}
	} catch (error) {
		console.error('[STT API] Error:', error);
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, config, audio } = await request.json();

		switch (action) {
			case 'transcribe': {
				if (!audio || !Array.isArray(audio)) {
					return json(
						{
							success: false,
							message: 'Audio data is required as Float32Array'
						},
						{ status: 400 }
					);
				}

				const whisperClient = new WhisperClient(config?.whisper);
				const audioArray = new Float32Array(audio);
				const result = await whisperClient.transcribe(audioArray);
				await whisperClient.dispose();

				return json({
					success: true,
					data: result
				});
			}

			case 'test-transcription': {
				// Create test audio (1 second of silence at 16kHz)
				const testAudio = new Float32Array(16000).fill(0);
				const testClient = new WhisperClient(config?.whisper);
				const testResult = await testClient.transcribe(testAudio);
				await testClient.dispose();

				return json({
					success: true,
					data: testResult,
					message: 'Test transcription completed successfully'
				});
			}

			default:
				return json(
					{
						success: false,
						message: 'Invalid action. Available actions: transcribe, test-transcription'
					},
					{ status: 400 }
				);
		}
	} catch (error) {
		console.error('[STT API] Error:', error);
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};
