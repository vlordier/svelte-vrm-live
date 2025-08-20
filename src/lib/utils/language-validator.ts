// Dynamic import for CLD3 to avoid SSR issues
let cld3: unknown = null;

export interface LanguageValidationResult {
	isEnglish: boolean;
	detectedLanguage: string;
	confidence: number;
	rawText: string;
	cleanedText: string;
}

export interface LanguageValidationOptions {
	minEnglishConfidence: number;
	allowMixedLanguage: boolean;
	maxNonEnglishPercentage: number;
}

const DEFAULT_OPTIONS: LanguageValidationOptions = {
	minEnglishConfidence: 0.7,
	allowMixedLanguage: false,
	maxNonEnglishPercentage: 0.05 // Allow 5% non-English characters
};

/**
 * Comprehensive English language validator with multiple detection methods
 */
export class LanguageValidator {
	private options: LanguageValidationOptions;
	private langId: unknown = null;
	private initPromise: Promise<unknown> | null = null;

	constructor(options: Partial<LanguageValidationOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	/**
	 * Initialize CLD3 language detector (async, cached)
	 */
	private async initializeCLD3() {
		if (this.langId) return this.langId;

		if (!this.initPromise) {
			try {
				// Dynamic import to avoid SSR issues
				if (!cld3) {
					const cld3Module = await import('cld3-asm');
					cld3 = cld3Module.default || cld3Module;
				}
				this.initPromise = (cld3 as any).load();
			} catch (error) {
				console.warn('[LanguageValidator] Failed to import CLD3:', error);
				throw error;
			}
		}

		this.langId = await this.initPromise;
		console.log('[LanguageValidator] CLD3 initialized successfully');
		return this.langId;
	}

	/**
	 * Main validation method - checks if text is primarily English
	 * Uses CLD3 when available, falls back to reliable character analysis
	 */
	async validateEnglish(text: string): Promise<LanguageValidationResult> {
		// Check if we're in a server environment - if so, use sync method
		if (typeof window === 'undefined') {
			console.log('[LanguageValidator] Server environment, using sync validation');
			return this.validateEnglishSync(text);
		}

		const cleanedText = this.cleanText(text);

		try {
			// Try CLD3 for client-side accuracy
			const detector = await this.initializeCLD3();
			const detection = (detector as any).findLanguage(cleanedText);

			const isEnglish = detection.language === 'en' && detection.probability >= 0.7;

			console.log('[LanguageValidator] CLD3 validation:', {
				text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
				detected: detection.language,
				probability: detection.probability,
				isEnglish
			});

			return {
				isEnglish,
				detectedLanguage: detection.language,
				confidence: detection.probability,
				rawText: text,
				cleanedText
			};
		} catch (error) {
			console.warn('[LanguageValidator] CLD3 failed, using sync fallback:', error);
			return this.validateEnglishSync(text);
		}
	}

	/**
	 * Synchronous fallback validation for when CLD3 async isn't available
	 */
	validateEnglishSync(text: string): LanguageValidationResult {
		const cleanedText = this.cleanText(text);
		const hasNonEnglishChars = this.hasNonEnglishCharacters(cleanedText);
		const isEnglish = !hasNonEnglishChars;
		const confidence = isEnglish ? 0.9 : 0.1;

		console.log('[LanguageValidator] Sync validation:', {
			text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
			cleanedText,
			hasNonEnglishChars,
			isEnglish,
			confidence
		});

		return {
			isEnglish,
			detectedLanguage: isEnglish ? 'en' : 'unknown',
			confidence,
			rawText: text,
			cleanedText
		};
	}

	/**
	 * Simple check for obvious non-English characters
	 */
	private hasNonEnglishCharacters(text: string): boolean {
		// Check for common non-English scripts
		const nonEnglishPatterns = [
			/[\u4e00-\u9fff]/, // Chinese characters
			/[\u3040-\u309f]/, // Hiragana
			/[\u30a0-\u30ff]/, // Katakana
			/[\u0400-\u04ff]/, // Cyrillic
			/[\u0590-\u05ff]/, // Hebrew
			/[\u0600-\u06ff]/, // Arabic
			/[\u0900-\u097f]/, // Hindi/Devanagari
			/[\u0980-\u09ff]/ // Bengali
		];

		return nonEnglishPatterns.some((pattern) => pattern.test(text));
	}

	/**
	 * Method 1: Simple statistical language detection using common word patterns
	 */
	private detectWithFranc(text: string): { language: string; confidence: number } {
		try {
			const lowerText = text.toLowerCase();

			// Common English words and patterns (expanded list)
			const englishPatterns = [
				'the',
				'and',
				'or',
				'but',
				'in',
				'on',
				'at',
				'to',
				'for',
				'of',
				'with',
				'by',
				'i',
				'you',
				'he',
				'she',
				'it',
				'we',
				'they',
				'me',
				'him',
				'her',
				'us',
				'them',
				'is',
				'are',
				'was',
				'were',
				'be',
				'been',
				'have',
				'has',
				'had',
				'do',
				'does',
				'did',
				'what',
				'when',
				'where',
				'why',
				'who',
				'how',
				'hey',
				'hi',
				'hello',
				'thanks',
				'thank',
				'please',
				'yes',
				'no',
				'ok',
				'okay',
				'good',
				'bad',
				'nice',
				'great',
				'well',
				'fine',
				'can',
				'will',
				'would',
				'could',
				'my',
				'your',
				'his',
				'her',
				'its',
				'our',
				'their',
				'this',
				'that',
				'these',
				'those'
			];

			// Check for English word matches
			let englishMatches = 0;
			for (const word of englishPatterns) {
				if (lowerText.includes(word)) {
					englishMatches++;
				}
			}

			// More lenient scoring based on English word presence
			const confidence = Math.min(englishMatches / 5, 1.0); // Reduced denominator
			const isEnglish = confidence > 0.2; // Lowered threshold

			return {
				language: isEnglish ? 'eng' : 'unknown',
				confidence: isEnglish ? confidence : 1.0 - confidence
			};
		} catch (error) {
			console.warn('[LanguageValidator] Pattern detection failed:', error);
			return { language: 'unknown', confidence: 0.5 };
		}
	}

	/**
	 * Method 2: Character-based analysis
	 */
	private analyzeCharacters(text: string): { confidence: number } {
		if (!text.trim()) return { confidence: 0 };

		const totalChars = text.length;
		let englishChars = 0;
		let nonEnglishChars = 0;

		for (const char of text) {
			const code = char.charCodeAt(0);

			// Basic Latin (ASCII) - English alphabet, numbers, punctuation
			if (code >= 32 && code <= 126) {
				englishChars++;
			}
			// Extended Latin (accented characters) - often used in English
			else if (code >= 160 && code <= 255) {
				englishChars += 0.5; // Half weight for extended Latin
			}
			// Whitespace and common symbols
			else if (/\s/.test(char) || /[.,!?;:()[\]{}'""-]/.test(char)) {
				englishChars++;
			}
			// Non-English scripts (CJK, Arabic, Cyrillic, etc.)
			else if (
				(code >= 0x4e00 && code <= 0x9fff) || // CJK
				(code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
				(code >= 0x0400 && code <= 0x04ff) || // Cyrillic
				(code >= 0x0590 && code <= 0x05ff) || // Hebrew
				(code >= 0x0600 && code <= 0x06ff) || // Arabic
				(code >= 0x3040 && code <= 0x309f) || // Hiragana
				(code >= 0x30a0 && code <= 0x30ff) // Katakana
			) {
				nonEnglishChars++;
			}
		}

		const englishPercentage = englishChars / totalChars;
		const nonEnglishPercentage = nonEnglishChars / totalChars;

		// High confidence if mostly English chars and low non-English
		const confidence =
			nonEnglishPercentage <= this.options.maxNonEnglishPercentage
				? Math.min(englishPercentage, 1.0)
				: Math.max(0.0, 1.0 - nonEnglishPercentage * 4);

		return { confidence: Math.max(0, Math.min(1, confidence)) };
	}

	/**
	 * Method 3: Word pattern analysis
	 */
	private analyzeWordPatterns(text: string): { confidence: number } {
		const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
		if (words.length === 0) return { confidence: 0 };

		// Common English patterns and words
		const englishPatterns = [
			// Articles and common words
			/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g,
			// Pronouns
			/\b(i|you|he|she|it|we|they|me|him|her|us|them)\b/g,
			// Common verbs
			/\b(is|are|was|were|be|been|have|has|had|do|does|did)\b/g,
			// Question words
			/\b(what|when|where|why|who|how)\b/g
		];

		let englishWordCount = 0;
		for (const pattern of englishPatterns) {
			const matches = text.toLowerCase().match(pattern);
			if (matches) englishWordCount += matches.length;
		}

		// Also check for typical English word structures
		const englishStructures = words.filter(
			(word) =>
				/^[a-z]+$/.test(word) && // Only Latin letters
				word.length >= 2 &&
				!/(.)\1{3,}/.test(word) && // Not too many repeated chars
				this.hasEnglishVowelPatterns(word)
		).length;

		const structureConfidence = englishStructures / words.length;
		const patternConfidence = Math.min(englishWordCount / words.length, 1.0);

		return { confidence: (structureConfidence + patternConfidence) / 2 };
	}

	/**
	 * Check if word has typical English vowel patterns
	 */
	private hasEnglishVowelPatterns(word: string): boolean {
		const vowels = word.match(/[aeiou]/g);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _consonants = word.match(/[bcdfghjklmnpqrstvwxyz]/g);

		// English words typically have vowels
		if (!vowels) return false;

		// Reasonable vowel to consonant ratio
		const vowelRatio = vowels.length / word.length;
		return vowelRatio >= 0.2 && vowelRatio <= 0.7;
	}

	/**
	 * Clean text for analysis - remove extra whitespace, normalize
	 */
	private cleanText(text: string): string {
		return text
			.trim()
			.replace(/\s+/g, ' ') // Normalize whitespace
			.replace(/[^\w\s.,!?;:()'"-]/g, '') // Remove unusual punctuation
			.slice(0, 1000); // Limit length for performance
	}

	/**
	 * Sanitize text to remove non-English characters (emergency fallback)
	 */
	sanitizeToEnglish(text: string): string {
		return (
			text
				// Keep only basic Latin, whitespace, and common punctuation
				.replace(/[^\u0020-\u007E\u00A0-\u00FF\s]/g, '')
				// Replace multiple spaces with single space
				.replace(/\s+/g, ' ')
				// Remove leading/trailing whitespace
				.trim()
		);
	}

	/**
	 * Generate fallback English text if validation fails
	 */
	generateEnglishFallback(originalPrompt: string): string {
		// Simple fallback responses based on prompt analysis
		const prompt = originalPrompt.toLowerCase();

		if (prompt.includes('hello') || prompt.includes('hi')) {
			return 'Hello there! How can I help you today?';
		}
		if (prompt.includes('name')) {
			return "I'm EMO, your virtual companion. What would you like to talk about?";
		}
		if (prompt.includes('?')) {
			return 'I understand you have a question. Could you please rephrase it in English so I can help you better?';
		}

		return 'I appreciate you reaching out. Could you please share your thoughts in English so we can have a meaningful conversation?';
	}
}

// Singleton instance for consistent usage
export const languageValidator = new LanguageValidator();
