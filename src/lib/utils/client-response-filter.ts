/**
 * Client-side response filter as final safety layer
 * Runs in the browser before displaying messages to user
 */

export interface FilterResult {
	isClean: boolean;
	cleanedMessage: string;
	originalMessage: string;
	warnings: string[];
}

export class ClientResponseFilter {
	private static instance: ClientResponseFilter;

	static getInstance(): ClientResponseFilter {
		if (!ClientResponseFilter.instance) {
			ClientResponseFilter.instance = new ClientResponseFilter();
		}
		return ClientResponseFilter.instance;
	}

	/**
	 * Final client-side filter before displaying response
	 */
	filterResponse(message: string): FilterResult {
		const warnings: string[] = [];
		let cleanedMessage = message;

		// Check 1: Remove non-English characters
		const nonEnglishRemoved = this.removeNonEnglishCharacters(cleanedMessage);
		if (nonEnglishRemoved !== cleanedMessage) {
			warnings.push('Removed non-English characters from response');
			cleanedMessage = nonEnglishRemoved;
		}

		// Check 2: Ensure minimum length
		if (cleanedMessage.trim().length < 5) {
			warnings.push('Response too short after filtering, using fallback');
			cleanedMessage = this.generateMinimalFallback();
		}

		// Check 3: Validate basic English structure
		if (!this.hasBasicEnglishStructure(cleanedMessage)) {
			warnings.push('Response lacks basic English structure, using fallback');
			cleanedMessage = this.generateStructuredFallback(message);
		}

		return {
			isClean: warnings.length === 0,
			cleanedMessage: cleanedMessage.trim(),
			originalMessage: message,
			warnings
		};
	}

	/**
	 * Remove non-English characters, keep only safe characters
	 */
	private removeNonEnglishCharacters(text: string): string {
		return (
			text
				// Keep only: letters, numbers, basic punctuation, whitespace
				.replace(/[^\u0020-\u007E\u00A0-\u00FF\s]/g, '')
				// Remove excessive whitespace
				.replace(/\s+/g, ' ')
				.trim()
		);
	}

	/**
	 * Check if text has basic English word structure
	 */
	private hasBasicEnglishStructure(text: string): boolean {
		// Must contain at least some letters
		if (!/[a-zA-Z]/.test(text)) return false;

		// Must contain at least one word
		const words = text.match(/\b[a-zA-Z]+\b/g);
		if (!words || words.length === 0) return false;

		// Check for reasonable word lengths
		const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
		return averageWordLength >= 2 && averageWordLength <= 15;
	}

	/**
	 * Generate minimal fallback response
	 */
	private generateMinimalFallback(): string {
		const fallbacks = [
			"I'm here to listen.",
			'Tell me more about that.',
			'I understand.',
			"That's interesting.",
			"I'm thinking about what you said."
		];
		return fallbacks[Math.floor(Math.random() * fallbacks.length)];
	}

	/**
	 * Generate contextual fallback based on original message
	 */
	private generateStructuredFallback(originalMessage: string): string {
		// Try to extract any English words that were in the original
		const englishWords = originalMessage.match(/\b[a-zA-Z]+\b/g);

		if (englishWords && englishWords.length > 0) {
			return `I hear you mentioning ${englishWords[0]}. Could you tell me more about that?`;
		}

		return 'I want to understand you better. Could you share your thoughts with me?';
	}

	/**
	 * Validate that a message is safe to display and speak
	 */
	validateForTTS(message: string): boolean {
		// Must be primarily English characters
		const englishChars = message.match(/[a-zA-Z\s.,!?]/g)?.length || 0;
		const totalChars = message.length;

		return totalChars > 0 && englishChars / totalChars >= 0.8;
	}

	/**
	 * Pre-process message before sending to TTS
	 */
	prepareForTTS(message: string): string {
		return (
			this.removeNonEnglishCharacters(message)
				// Normalize punctuation for better TTS
				.replace(/[""]/g, '"')
				.replace(/['']/g, "'")
				.replace(/…/g, '...')
				// Remove excessive punctuation
				.replace(/[.]{4,}/g, '...')
				.replace(/[!]{2,}/g, '!')
				.replace(/[?]{2,}/g, '?')
				.trim()
		);
	}
}

// Export singleton instance
export const clientResponseFilter = ClientResponseFilter.getInstance();
