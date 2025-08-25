import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { UnifiedTTSClient, type TTSProvider } from '$lib/tts/client';
import { TTSCache } from '$lib/tts/cache';

interface GenerateControlsRequest {
	text: string;
	type: 'phonemes' | 'blendshapes';
	provider?: TTSProvider;
	voice?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	let requestData: GenerateControlsRequest;
	try {
		requestData = await request.json();
	} catch {
		throw error(400, 'Invalid request body: Must be valid JSON');
	}

	const { text, type, provider, voice } = requestData;

	if (!text || typeof text !== 'string') {
		throw error(400, "Missing or invalid 'text' property");
	}

	if (!type || !['phonemes', 'blendshapes'].includes(type)) {
		throw error(400, "Invalid 'type' property. Must be 'phonemes' or 'blendshapes'");
	}

	const ttsProvider = provider || env.TTS_PROVIDER || 'kokoro';
	const ttsVoice = voice || env.KOKORO_VOICE || 'af_bella';

	console.log(
		`[Generate Controls] Generating ${type} controls for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
	);

	try {
		if (type === 'phonemes') {
			// Generate phoneme controls using fallback phoneme generation
			const controlData = await generatePhonemeControls(text, ttsProvider, ttsVoice);

			// Cache the control data
			TTSCache.cacheControl(text, ttsVoice, ttsProvider, controlData, undefined);

			return json({
				success: true,
				type: 'phonemes',
				data: controlData,
				cached: true
			});
		} else {
			// Generate blendshape controls using Audio2Expression
			const controlData = await generateBlendshapeControls(text, ttsProvider, ttsVoice);

			// Cache the control data
			TTSCache.cacheControl(text, ttsVoice, ttsProvider, undefined, controlData);

			return json({
				success: true,
				type: 'blendshapes',
				data: controlData,
				cached: true
			});
		}
	} catch (e: unknown) {
		console.error(`[Generate Controls] Error generating ${type} controls:`, e);
		throw error(
			500,
			`Control generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`
		);
	}
};

async function generatePhonemeControls(text: string, provider: string, voice: string) {
	// Get audio duration from TTS first
	const ttsClient = new UnifiedTTSClient({
		provider: provider as TTSProvider,
		voice: voice
	});

	const result = await ttsClient.synthesize(text);
	await ttsClient.dispose();

	// Use the same fallback phoneme generation logic from tts.ts
	return generateFallbackPhonemes(text, result.duration);
}

async function generateBlendshapeControls(text: string, provider: string, voice: string) {
	try {
		// Get audio from TTS
		const ttsClient = new UnifiedTTSClient({
			provider: provider as TTSProvider,
			voice: voice
		});

		const result = await ttsClient.synthesize(text);
		await ttsClient.dispose();

		// Convert ArrayBuffer to base64 for Audio2Expression API
		const base64Audio = Buffer.from(result.audio).toString('base64');

		// Call Audio2Expression API
		const response = await fetch('http://localhost:8001/process', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				audio: base64Audio,
				sample_rate: result.sampleRate,
				format: 'wav'
			})
		});

		if (!response.ok) {
			throw new Error(`Audio2Expression API error: ${response.status}`);
		}

		const blendshapeResult = await response.json();

		if (!blendshapeResult.success) {
			throw new Error(blendshapeResult.error || 'API returned error status');
		}

		return blendshapeResult.blendshapes || [];
	} catch (error) {
		console.error('[Generate Controls] Blendshape generation failed:', error);
		// Return empty array as fallback
		return [];
	}
}

// Copy of the fallback phoneme generation from tts.ts
function generateFallbackPhonemes(
	text: string,
	totalDuration: number
): Array<{ phoneme: string; start: number; end: number }> {
	const timings: Array<{ phoneme: string; start: number; end: number }> = [];

	// Simple word and syllable analysis
	const words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.filter((w) => w.length > 0);
	const totalSyllables = words.reduce((count, word) => count + countSyllables(word), 0);

	if (totalSyllables === 0) return timings;

	const avgSyllableDuration = totalDuration / totalSyllables;
	let currentTime = 0.1; // Start slightly delayed

	for (const word of words) {
		const syllables = breakIntoSyllables(word);

		for (const syllable of syllables) {
			// Map syllable to dominant vowel sound
			const phoneme = mapSyllableToPhoneme(syllable);
			const duration = Math.min(avgSyllableDuration * 0.8, 0.25); // Cap at 250ms

			timings.push({
				phoneme,
				start: currentTime,
				end: currentTime + duration
			});

			currentTime += avgSyllableDuration;
		}

		// Add brief pause between words
		currentTime += avgSyllableDuration * 0.2;
	}

	return timings;
}

function countSyllables(word: string): number {
	const vowelGroups = word.match(/[aeiouAEIOU]+/g) || [];
	let count = vowelGroups.length;

	if (word.endsWith('e') && count > 1) count--; // Silent e
	if (word.includes('tion') || word.includes('sion')) count += 1; // These add syllables

	return Math.max(1, count);
}

function breakIntoSyllables(word: string): string[] {
	const syllables: string[] = [];
	let current = '';

	for (let i = 0; i < word.length; i++) {
		const char = word[i];
		current += char;

		if (isVowel(char) && i < word.length - 1 && !isVowel(word[i + 1])) {
			let nextVowelIndex = i + 1;
			while (nextVowelIndex < word.length && !isVowel(word[nextVowelIndex])) {
				nextVowelIndex++;
			}

			if (nextVowelIndex < word.length) {
				syllables.push(current);
				current = '';
			}
		}
	}

	if (current) syllables.push(current);
	return syllables.length > 0 ? syllables : [word];
}

function isVowel(char: string): boolean {
	return 'aeiouAEIOU'.includes(char);
}

function mapSyllableToPhoneme(syllable: string): string {
	const s = syllable.toLowerCase();

	if (s.includes('ee') || s.includes('ea') || s.endsWith('e')) return 'EE';
	if (s.includes('oo') || s.includes('ou')) return 'UW';
	if (s.includes('oa') || s.includes('ow')) return 'OH';
	if (s.includes('ai') || s.includes('ay')) return 'AY';
	if (s.includes('au') || s.includes('aw')) return 'AW';
	if (s.includes('oi') || s.includes('oy')) return 'OY';
	if (s.includes('a')) return 'AA';
	if (s.includes('e')) return 'EH';
	if (s.includes('i')) return 'IH';
	if (s.includes('o')) return 'OH';
	if (s.includes('u')) return 'UH';

	return 'NEUTRAL'; // Consonant-heavy syllables
}
