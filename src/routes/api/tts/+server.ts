import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { UnifiedTTSClient, type TTSProvider } from '$lib/tts/client';
import { TTSCache } from '$lib/tts/cache';

interface TTSRequestBody {
	text: string;
	provider?: TTSProvider;
	voice?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	let requestData: TTSRequestBody;
	try {
		requestData = await request.json();
	} catch {
		throw error(400, "Invalid request body: Must be valid JSON with a 'text' property.");
	}

	const { text, provider, voice } = requestData;

	if (!text || typeof text !== 'string') {
		throw error(400, "Missing or invalid 'text' property in request body.");
	}

	// Determine which TTS provider to use
	const ttsProvider = provider || env.TTS_PROVIDER || 'kokoro';

	console.log(
		`[TTS API] Using provider: ${ttsProvider} for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
	);

	// Validate that browser TTS is not requested server-side
	if (ttsProvider === 'browser') {
		throw error(400, 'Browser TTS is a client-side feature and cannot be handled by the server.');
	}

	// Handle legacy ElevenLabs requests
	if (ttsProvider === 'elevenlabs') {
		return handleElevenLabsTTS(text);
	}

	// Check for cached welcome message first
	const welcomeTexts = [
		"Well hello there... First time here? What's your name? Tell me what brings you here?",
		'Well hello there', // Partial matches
		'hello there'
	];

	const isWelcomeMessage = welcomeTexts.some((welcomeText) =>
		text.toLowerCase().includes(welcomeText.toLowerCase())
	);

	if (isWelcomeMessage) {
		const cached = TTSCache.getCachedWelcomeMessage(text, voice || 'default', ttsProvider);
		if (cached) {
			console.log('[TTS API] Using cached welcome message');

			// Check for cached control data
			const cachedControl = TTSCache.getCachedControl(text, voice || 'default', ttsProvider);
			const phonemes = cachedControl?.phonemes || [];

			return json({
				audio_base64: cached.audioBase64,
				sample_rate: cached.sampleRate,
				duration: cached.duration,
				provider: cached.provider,
				voice: cached.voice,
				phonemes: phonemes,
				cached: true,
				controlCached: !!cachedControl
			});
		}
	}

	// Use new unified TTS client
	try {
		const ttsClient = new UnifiedTTSClient({
			provider: ttsProvider as TTSProvider,
			voice: voice
		});

		const result = await ttsClient.synthesize(text);
		await ttsClient.dispose();

		// Convert ArrayBuffer to base64
		const base64Audio = Buffer.from(result.audio).toString('base64');

		console.log(
			`[TTS API] Generated audio: ${base64Audio.length} chars, duration: ${result.duration.toFixed(2)}s`
		);

		// Cache welcome message and generate controls for future use
		if (isWelcomeMessage && base64Audio.length > 0) {
			TTSCache.cacheWelcomeMessage(
				text,
				voice || env.KOKORO_VOICE || 'af_bella',
				ttsProvider,
				base64Audio,
				result.sampleRate,
				result.duration
			);

			// Generate and cache phoneme controls
			try {
				const { generateFallbackPhonemes } = await import('$lib/audio/tts-phonemes');
				const phonemeTimings = generateFallbackPhonemes(text, result.duration);
				TTSCache.cacheControl(
					text,
					voice || env.KOKORO_VOICE || 'af_bella',
					ttsProvider,
					phonemeTimings,
					undefined
				);
			} catch (error) {
				console.log('[TTS API] Failed to generate phoneme controls:', error);
			}
		}

		// Generate fallback phonemes for all TTS requests
		let phonemeTimings: import('$lib/audio/tts-phonemes').PhonemeTiming[] = [];
		try {
			const { generateFallbackPhonemes } = await import('$lib/audio/tts-phonemes');
			phonemeTimings = generateFallbackPhonemes(text, result.duration);
			console.log(`[TTS API] Generated ${phonemeTimings.length} fallback phonemes`);
		} catch (error) {
			console.log('[TTS API] Failed to generate fallback phonemes:', error);
		}

		return json({
			audio_base64: base64Audio,
			sample_rate: result.sampleRate,
			duration: result.duration,
			provider: ttsProvider,
			voice: voice || env.KOKORO_VOICE || 'af_bella',
			phonemes: phonemeTimings,
			cached: false
		});
	} catch (e: unknown) {
		console.error(`[TTS API] Error with ${ttsProvider} provider:`, e);

		// Fallback to ElevenLabs if local TTS fails and API key is available
		if (env.ELEVENLABS_API_KEY && ttsProvider !== 'elevenlabs') {
			console.log('[TTS API] Falling back to ElevenLabs TTS');
			return handleElevenLabsTTS(text);
		}

		throw error(500, `TTS generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}
};

// Legacy ElevenLabs TTS handler
async function handleElevenLabsTTS(text: string) {
	const apiKey = env.ELEVENLABS_API_KEY;
	const voiceId = '3XOBzXhnDY98yeWQ3GdM';

	if (!apiKey) {
		console.error('ELEVENLABS_API_KEY is not set in environment variables.');
		throw error(500, 'TTS API key not configured. Please check server logs.');
	}

	try {
		const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

		const elevenLabsResponse = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'xi-api-key': apiKey,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				text: text,
				model_id: 'eleven_flash_v2_5',
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75
				}
			})
		});

		if (!elevenLabsResponse.ok) {
			const errorBody = await elevenLabsResponse.text();
			console.error(
				`ElevenLabs API error: ${elevenLabsResponse.status} ${elevenLabsResponse.statusText}`,
				errorBody
			);
			throw error(
				502,
				`Failed to fetch audio from ElevenLabs: ${elevenLabsResponse.statusText} - ${errorBody}`
			);
		}

		const responseData = await elevenLabsResponse.json();

		// Extract phonemes from ElevenLabs response
		let phonemes = [];

		if (
			responseData.alignment?.characters &&
			responseData.alignment?.character_start_times_seconds &&
			responseData.alignment?.character_end_times_seconds
		) {
			const characters = responseData.alignment.characters;
			const startTimes = responseData.alignment.character_start_times_seconds;
			const endTimes = responseData.alignment.character_end_times_seconds;

			for (let i = 0; i < characters.length; i++) {
				phonemes.push({
					character: characters[i],
					start: startTimes[i],
					end: endTimes[i]
				});
			}
		}

		console.log('[TTS API] ElevenLabs - Phonemes count:', phonemes.length);

		return json({
			audio_base64: responseData.audio_base64,
			phonemes: phonemes,
			provider: 'elevenlabs'
		});
	} catch (e: unknown) {
		console.error('Error with ElevenLabs TTS:', e);
		throw error(500, `ElevenLabs TTS failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}
}
