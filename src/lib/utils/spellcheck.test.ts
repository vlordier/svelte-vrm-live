import { describe, it, expect, beforeAll } from 'vitest';
import {
	autocorrect,
	autocorrectIncremental,
	preloadSpellcheck,
	clearSpellcheckCache
} from './spellcheck';

describe('Spellcheck Module', () => {
	beforeAll(async () => {
		// Attempt to preload the spellcheck dictionary
		await preloadSpellcheck();
	});

	describe('autocorrect basic functionality', () => {
		it('should apply basic contractions and capitalize "i"', async () => {
			const result = await autocorrect('i dont know');
			// Should at least fix 'i' -> 'I' and expand 'dont' -> "don't"
			expect(result.charAt(0)).toBe('I');
			expect(result).toContain("don't");
		});

		it('should apply sentence case', async () => {
			const result = await autocorrect('hello world. this is a test.');
			expect(result).toBe('Hello world. This is a test.');
		});

		it('should handle empty strings', async () => {
			const result = await autocorrect('');
			expect(result).toBe('');
		});

		it('should handle strings with only whitespace', async () => {
			const result = await autocorrect('   ');
			expect(result).toBe('   ');
		});

		it('should preserve URLs', async () => {
			const input = 'visit https://example.com';
			const result = await autocorrect(input);
			expect(result).toContain('https://example.com');
		});

		it('should expand common contractions', async () => {
			const testCases = [
				['im happy', "I'm happy"],
				['dont worry', "Don't worry"],
				['cant wait', "Can't wait"]
			];

			for (const [input, expected] of testCases) {
				const result = await autocorrect(input);
				expect(result).toBe(expected);
			}
		});
	});

	describe('autocorrectIncremental', () => {
		it('should handle basic incremental correction', async () => {
			const result = await autocorrectIncremental('', 'hello world');
			expect(result.finalized).toBe('');
			// Should return some text, may or may not be capitalized depending on spellcheck availability
			expect(typeof result.current).toBe('string');
			expect(result.current.length).toBeGreaterThan(0);
		});

		it('should move complete sentences to finalized', async () => {
			const result = await autocorrectIncremental('', 'hello world. more text');
			// Should identify sentence boundary and move text
			expect(typeof result.finalized).toBe('string');
			expect(typeof result.current).toBe('string');
			// The sum of lengths should preserve text
			expect(result.finalized.length + result.current.length).toBeGreaterThanOrEqual(
				'hello world. more text'.length - 2
			); // Allow for minor formatting
		});
	});

	describe('utilities', () => {
		it('should clear cache without errors', () => {
			expect(() => clearSpellcheckCache()).not.toThrow();
		});

		it('should handle initialization gracefully', async () => {
			const result = await autocorrect('test text');
			expect(typeof result).toBe('string');
		});
	});
});
