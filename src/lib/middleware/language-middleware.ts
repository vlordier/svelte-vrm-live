/**
 * Server-side middleware for language validation and enforcement
 * This provides an additional layer of protection at the API level
 */

import type { RequestEvent } from '@sveltejs/kit';

 
import { error, json } from '@sveltejs/kit';
import { languageValidator } from '$lib/utils/language-validator';

export interface LanguageMiddlewareOptions {
	enforceEnglishInput: boolean;
	enforceEnglishOutput: boolean;
	autoCorrectInput: boolean;
	blockNonEnglishOutput: boolean;
}

const DEFAULT_OPTIONS: LanguageMiddlewareOptions = {
	enforceEnglishInput: false, // Allow non-English input, but respond in English
	enforceEnglishOutput: true, // Always enforce English output
	autoCorrectInput: false, // Don't auto-correct user input
	blockNonEnglishOutput: true // Block non-English responses
};

export class LanguageMiddleware {
	private options: LanguageMiddlewareOptions;

	constructor(options: Partial<LanguageMiddlewareOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	/**
	 * Validate request payload for language compliance
	 */
	async validateRequest(event: RequestEvent): Promise<Record<string, unknown>> {
		const body = await event.request.json();

		// Validate user prompt if enforcement is enabled
		if (this.options.enforceEnglishInput && body.prompt) {
			const validation = await languageValidator.validateEnglish(body.prompt);

			if (!validation.isEnglish) {
				console.warn('[LanguageMiddleware] Non-English input detected:', {
					detectedLanguage: validation.detectedLanguage,
					confidence: validation.confidence
				});

				if (this.options.autoCorrectInput) {
					body.prompt = languageValidator.sanitizeToEnglish(body.prompt);
				} else {
					throw error(400, 'Please provide your input in English only.');
				}
			}
		}

		// Enhance system instruction for English enforcement
		if (body.systemInstruction) {
			body.systemInstruction = this.enhanceSystemInstruction(body.systemInstruction);
		}

		return body;
	}

	/**
	 * Validate response before sending to client
	 */
	async validateResponse(response: Record<string, unknown>): Promise<Record<string, unknown>> {
		if (!this.options.enforceEnglishOutput) {
			return response;
		}

		// Check if response has an answer field (common in LLM responses)
		if (response.answer) {
			const validation = await languageValidator.validateEnglish(response.answer as string);

			console.log('[LanguageMiddleware] Response validation:', {
				isEnglish: validation.isEnglish,
				confidence: validation.confidence,
				detectedLanguage: validation.detectedLanguage
			});

			if (!validation.isEnglish && this.options.blockNonEnglishOutput) {
				console.error('[LanguageMiddleware] Blocking non-English response:', response.answer);

				// Replace with safe English fallback
				response.answer =
					"I apologize, but I'm having difficulty expressing my thoughts clearly right now. Could you please rephrase your question to help me provide a better response?";
				response.emotion = response.emotion || 'neutral';

				// Add warning flag
				response._languageWarning = true;
				response._originalLanguage = validation.detectedLanguage;
			}
		}

		return response;
	}

	/**
	 * Enhance system instruction with robust English constraints
	 */
	private enhanceSystemInstruction(originalInstruction: string): string {
		const englishEnforcement = `

MANDATORY LANGUAGE PROTOCOL:
1. You MUST respond exclusively in English language
2. NEVER use Chinese (中文), Japanese (日本語), Korean (한국어), Arabic (العربية), Russian (русский), Hindi, or any non-English languages
3. Use ONLY Latin alphabet characters: A-Z, a-z, numbers 0-9, and standard punctuation: . , ! ? ; : ( ) " ' -
4. If user writes in another language, acknowledge but respond in English only
5. Examples of FORBIDDEN characters: 你好, こんにちは, 안녕하세요, مرحبا, привет, नमस्ते
6. Examples of REQUIRED responses: "Hello", "I understand", "Thank you", "How are you?"

${originalInstruction}`;

		return englishEnforcement;
	}

	/**
	 * Create express-style middleware function
	 */
	createHandler() {
		return async (event: RequestEvent, next: () => Promise<Response>) => {
			try {
				// Validate and potentially modify request
				const validatedBody = await this.validateRequest(event);

				// Replace request body with validated version
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const _modifiedEvent = {
					...event,
					request: new Request(event.request.url, {
						method: event.request.method,
						headers: event.request.headers,
						body: JSON.stringify(validatedBody)
					})
				};

				// Call the next handler
				const response = await next();

				// Validate response if it's JSON
				if (response.headers.get('content-type')?.includes('application/json')) {
					const responseData = await response.json();
					const validatedResponse = await this.validateResponse(responseData);

					return json(validatedResponse);
				}

				return response;
			} catch (err) {
				console.error('[LanguageMiddleware] Error:', err);
				throw err;
			}
		};
	}
}

// Export singleton instance
export const languageMiddleware = new LanguageMiddleware();
