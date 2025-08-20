import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UnifiedLLMClient } from '$lib/llm/client';
import { generateAnswerWithEmotion } from '$lib/llm/generative';

// Basic interface for the expected request body.
interface GenerateRequestBody {
	systemInstruction: string;
	prompt: string;
}

export const POST: RequestHandler = async ({ request }) => {
	let requestData: GenerateRequestBody;
	try {
		requestData = await request.json();
	} catch {
		throw error(400, 'Invalid request body: Must be valid JSON.');
	}

	// Apply enhanced system instruction directly (simpler approach)
	if (requestData.systemInstruction) {
		requestData.systemInstruction = `${requestData.systemInstruction}

CRITICAL LANGUAGE REQUIREMENTS:
- You MUST respond ONLY in English language
- Never use Chinese, Japanese, Korean, Arabic, Russian, or any non-English characters  
- Use only Latin alphabet (A-Z, a-z), numbers (0-9), and standard punctuation
- If user writes in another language, still respond in English only`;
	}

	const { systemInstruction, prompt } = requestData;

	if (!systemInstruction || !prompt) {
		throw error(400, 'Missing required fields: systemInstruction and prompt are required.');
	}

	try {
		const llmClient = new UnifiedLLMClient();
		const result = await generateAnswerWithEmotion(llmClient, systemInstruction, prompt);

		// Ensure result has proper structure
		if (!result || typeof result !== 'object') {
			throw error(500, 'Invalid response structure from LLM');
		}

		// Ensure answer field exists and is a string
		if (!result.answer || typeof result.answer !== 'string') {
			console.warn('[Generate API] Missing or invalid answer field, using fallback');
			result.answer =
				"I apologize, but I'm having trouble processing your request right now. Could you please try again?";
			result.emotion = 'neutral';
		}

		// Simple response validation for non-English characters
		if (result.answer && typeof result.answer === 'string') {
			// Basic non-English character detection
			const hasNonEnglish =
				/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff]/.test(
					result.answer
				);

			if (hasNonEnglish) {
				console.warn('[Generate API] Non-English characters detected, using fallback');
				result.answer =
					"I apologize, but I'm having difficulty expressing my thoughts clearly right now. Could you please rephrase your question to help me provide a better response?";
				result.emotion = result.emotion || 'neutral';
			}
		}

		console.log(
			'Generated answer:',
			result.answer ? result.answer.substring(0, 100) + '...' : 'No answer generated'
		);
		return json(result);
	} catch (e: unknown) {
		console.error('Error generating structured output:', e);
		// Provide a more generic error to the client for security
		throw error(
			500,
			`Failed to generate content: ${e instanceof Error ? e.message : 'Internal Server Error'}`
		);
	}
};
