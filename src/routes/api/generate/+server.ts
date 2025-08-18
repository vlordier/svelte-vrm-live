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

	const { systemInstruction, prompt } = requestData;

	if (!systemInstruction || !prompt) {
		throw error(400, 'Missing required fields: systemInstruction and prompt are required.');
	}

	try {
		const llmClient = new UnifiedLLMClient();
		const result = await generateAnswerWithEmotion(llmClient, systemInstruction, prompt);
		console.log('Generated answer with emotion:', result);
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
