// Phoneme generation utilities for TTS lip sync

export interface PhonemeTiming {
	phoneme: string;
	start: number; // seconds
	end: number; // seconds
}

export function generateFallbackPhonemes(text: string, totalDuration: number): PhonemeTiming[] {
	const timings: PhonemeTiming[] = [];

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
	// Simple syllable counting based on vowel groups
	const vowelGroups = word.match(/[aeiouAEIOU]+/g) || [];
	let count = vowelGroups.length;

	// Adjust for common patterns
	if (word.endsWith('e') && count > 1) count--; // Silent e
	if (word.includes('tion') || word.includes('sion')) count += 1; // These add syllables

	return Math.max(1, count);
}

function breakIntoSyllables(word: string): string[] {
	// Very simple syllable breaking - split on vowel-consonant boundaries
	const syllables: string[] = [];
	let current = '';

	for (let i = 0; i < word.length; i++) {
		const char = word[i];
		current += char;

		// If we hit a vowel followed by consonant(s), split
		if (isVowel(char) && i < word.length - 1 && !isVowel(word[i + 1])) {
			// Look ahead to find good split point
			let nextVowelIndex = i + 1;
			while (nextVowelIndex < word.length && !isVowel(word[nextVowelIndex])) {
				nextVowelIndex++;
			}

			if (nextVowelIndex < word.length) {
				// Split before the consonant cluster if there's another vowel
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

	// Map syllable patterns to phonemes
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
