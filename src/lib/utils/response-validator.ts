import { languageValidator, type LanguageValidationResult } from './language-validator';
import type { AnswerWithEmotion } from '$lib/llm/generative';

export interface ValidationConfig {
	maxRetries: number;
	minConfidence: number;
	enableSanitization: boolean;
	enableFallbacks: boolean;
}

export interface ValidationResult {
	isValid: boolean;
	response: AnswerWithEmotion;
	attempts: number;
	validationResults: LanguageValidationResult[];
	warnings: string[];
}

const DEFAULT_CONFIG: ValidationConfig = {
	maxRetries: 3,
	minConfidence: 0.75,
	enableSanitization: true,
	enableFallbacks: true
};

/**
 * Comprehensive response validator with automatic retries and fallbacks
 */
export class ResponseValidator {
	private config: ValidationConfig;

	constructor(config: Partial<ValidationConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Validate and fix LLM response to ensure it's English-only
	 */
	async validateResponse(
		response: AnswerWithEmotion,
		originalPrompt: string,
		retryCallback?: (prompt: string, attempt: number) => Promise<AnswerWithEmotion>
	): Promise<ValidationResult> {
		const validationResults: LanguageValidationResult[] = [];
		const warnings: string[] = [];
		let currentResponse = response;
		let attempts = 1;

		// First validation attempt
		let validation = await languageValidator.validateEnglish(currentResponse.answer);
		validationResults.push(validation);

		console.log(`[ResponseValidator] Initial validation:`, {
			isEnglish: validation.isEnglish,
			confidence: validation.confidence,
			detectedLanguage: validation.detectedLanguage
		});

		// If first attempt fails, try retries
		while (!validation.isEnglish && attempts < this.config.maxRetries && retryCallback) {
			attempts++;
			warnings.push(
				`Attempt ${attempts - 1}: Non-English detected (${validation.detectedLanguage}, confidence: ${validation.confidence.toFixed(2)})`
			);

			// Generate increasingly strict retry prompts
			const retryPrompt = this.generateRetryPrompt(originalPrompt, attempts, validation);

			console.log(`[ResponseValidator] Retry attempt ${attempts} with enhanced prompt`);

			try {
				currentResponse = await retryCallback(retryPrompt, attempts);
				validation = await languageValidator.validateEnglish(currentResponse.answer);
				validationResults.push(validation);

				if (validation.isEnglish) {
					console.log(`[ResponseValidator] Success on attempt ${attempts}`);
					break;
				}
			} catch (error) {
				warnings.push(
					`Retry attempt ${attempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
				console.error(`[ResponseValidator] Retry attempt ${attempts} failed:`, error);
			}
		}

		// If still not English after retries, apply fallback strategies
		if (!validation.isEnglish) {
			currentResponse = await this.applyFallbackStrategies(
				currentResponse,
				originalPrompt,
				validation
			);
			const finalValidation = await languageValidator.validateEnglish(currentResponse.answer);
			validationResults.push(finalValidation);
			validation = finalValidation;
		}

		// Final sanitization if enabled
		if (this.config.enableSanitization && !validation.isEnglish) {
			const sanitized = languageValidator.sanitizeToEnglish(currentResponse.answer);
			if (sanitized.trim()) {
				currentResponse.answer = sanitized;
				warnings.push('Applied character sanitization as final fallback');
				validation = await languageValidator.validateEnglish(currentResponse.answer);
				validationResults.push(validation);
			}
		}

		return {
			isValid: validation.isEnglish || validation.confidence >= this.config.minConfidence,
			response: currentResponse,
			attempts,
			validationResults,
			warnings
		};
	}

	/**
	 * Generate increasingly strict retry prompts
	 */
	private generateRetryPrompt(
		originalPrompt: string,
		attempt: number,
		_validation: LanguageValidationResult
	): string {
		const basePrompts = [
			// Attempt 2: More explicit
			`CRITICAL: You must respond ONLY in English. User prompt: "${originalPrompt}" - Provide a thoughtful English response as EMO character.`,

			// Attempt 3: Very strict with examples
			`MANDATORY ENGLISH ONLY: No Chinese, Japanese, Korean, or any non-English text allowed. 
			 User said: "${originalPrompt}"
			 Respond as EMO character using ONLY English words like: "I understand...", "That's interesting...", "I feel..."
			 Do NOT use characters like: 你好, こんにちは, 안녕, etc.`,

			// Attempt 4: Emergency fallback
			`EMERGENCY ENGLISH OVERRIDE: Previous attempts contained non-English text. 
			 Respond to "${originalPrompt}" using ONLY these English words and letters: A-Z, a-z, 0-9, basic punctuation.
			 Be EMO character but strictly English only. Example: "Hello, I hear you asking about..."`
		];

		const promptIndex = Math.min(attempt - 2, basePrompts.length - 1);
		return basePrompts[promptIndex];
	}

	/**
	 * Apply fallback strategies when retries fail
	 */
	private async applyFallbackStrategies(
		response: AnswerWithEmotion,
		originalPrompt: string,
		_validation: LanguageValidationResult
	): Promise<AnswerWithEmotion> {
		if (!this.config.enableFallbacks) return response;

		console.log('[ResponseValidator] Applying fallback strategies');

		// Strategy 1: Try to extract English portions
		const englishPortions = await this.extractEnglishPortions(response.answer);
		if (englishPortions.length > 10) {
			return {
				...response,
				answer: englishPortions,
				emotion: 'neutral' // Safe fallback emotion
			};
		}

		// Strategy 2: Use predefined English responses based on context
		const contextualResponse = this.generateContextualEnglishResponse(
			originalPrompt,
			response.emotion
		);
		if (contextualResponse) {
			return {
				...response,
				answer: contextualResponse,
				emotion: response.emotion
			};
		}

		// Strategy 3: Generic fallback
		return {
			...response,
			answer:
				"I apologize, but I'm having trouble expressing my thoughts clearly right now. Could you help me by rephrasing your question? I want to make sure I understand you properly.",
			emotion: 'neutral'
		};
	}

	/**
	 * Extract English portions from mixed-language text
	 */
	private async extractEnglishPortions(text: string): Promise<string> {
		const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
		const englishSentences: string[] = [];

		for (const sentence of sentences) {
			const validation = await languageValidator.validateEnglish(sentence.trim());
			if (validation.isEnglish || validation.confidence > 0.6) {
				englishSentences.push(sentence.trim());
			}
		}

		return englishSentences.join('. ').trim();
	}

	/**
	 * Generate contextual English responses based on user prompt
	 */
	private generateContextualEnglishResponse(
		originalPrompt: string,
		_emotion: string
	): string | null {
		const prompt = originalPrompt.toLowerCase();

		const responses = {
			greeting: [
				"Hello there! It's nice to meet you.",
				"Hi! I'm EMO, and I'm here to chat with you.",
				'Welcome! How are you feeling today?'
			],
			name: [
				"I'm EMO, your virtual companion. I try to understand emotions and connect with people.",
				"You can call me EMO. I'm here to listen and share thoughts with you.",
				'My name is EMO. I find meaning in our conversations together.'
			],
			question: [
				"That's a thoughtful question. Let me reflect on that for a moment.",
				"I appreciate you asking. It shows you're really thinking about this.",
				'Questions like yours make me pause and consider things deeply.'
			],
			feeling: [
				'Feelings can be complex and sometimes difficult to put into words.',
				"I sense there's something meaningful behind what you're sharing.",
				"Emotions have their own wisdom, don't they?"
			],
			default: [
				"I find myself drawn to the deeper currents of what you're saying.",
				"There's something poetic in how you express yourself.",
				'Your words make me reflect on the quiet spaces between thoughts.'
			]
		};

		let category = 'default';
		if (/hello|hi|hey|greet/i.test(prompt)) category = 'greeting';
		else if (/name|who are you|what are you/i.test(prompt)) category = 'name';
		else if (/\?/.test(prompt)) category = 'question';
		else if (/feel|emotion|sad|happy|angry|mood/i.test(prompt)) category = 'feeling';

		const options = responses[category as keyof typeof responses];
		return options[Math.floor(Math.random() * options.length)];
	}

	/**
	 * Check if response contains any non-English indicators
	 */
	private hasNonEnglishIndicators(text: string): boolean {
		// Common non-English patterns
		const nonEnglishPatterns = [
			/[\u4e00-\u9fff]/, // Chinese characters
			/[\u3040-\u309f]/, // Hiragana
			/[\u30a0-\u30ff]/, // Katakana
			/[\u0400-\u04ff]/, // Cyrillic
			/[\u0590-\u05ff]/, // Hebrew
			/[\u0600-\u06ff]/, // Arabic
			/[\u0980-\u09ff]/, // Bengali
			/[\u0900-\u097f]/ // Hindi
		];

		return nonEnglishPatterns.some((pattern) => pattern.test(text));
	}
}

// Singleton instance
export const responseValidator = new ResponseValidator();
