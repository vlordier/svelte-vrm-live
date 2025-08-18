import { UnifiedLLMClient } from './client';

const emotions = ['angry', 'happy', 'neutral', 'funny'];

export interface AnswerWithEmotion {
	answer: string;
	emotion: (typeof emotions)[number];
}

// OpenAPI schema for the AnswerWithEmotion structure
const answerEmotionSchema = {
	type: 'object',
	properties: {
		answer: {
			type: 'string',
			description: 'The textual answer to the prompt.'
		},
		emotion: {
			type: 'string',
			enum: emotions,
			description: `The dominant emotion conveyed in the answer (${emotions.join(', ')}).`
		}
	},
	required: ['answer', 'emotion']
} as const;

export async function generateStructuredOutput(
	llmClient: UnifiedLLMClient,
	systemInstruction: string,
	prompt: string,
	schema: Record<string, unknown>,
	maxRetries = 10
): Promise<string> {
	return await llmClient.generateStructuredOutput(systemInstruction, prompt, schema, maxRetries);
}

export async function generateAnswerWithEmotion(
	llmClient: UnifiedLLMClient,
	systemInstruction: string,
	prompt: string,
	maxRetries?: number
): Promise<AnswerWithEmotion> {
	const modifiedSystemInstruction = `${systemInstruction} When determining the emotion for your answer, consider the sentiment of the user's prompt. For example, if the user's prompt is aggressive, negative, or insulting, your answer's emotion should reflect an appropriate response, such as 'angry'. Conversely, if the prompt is positive or inquisitive, choose a corresponding emotion.`;
	const resultText = await generateStructuredOutput(
		llmClient,
		modifiedSystemInstruction,
		prompt,
		answerEmotionSchema,
		maxRetries
	);
	return JSON.parse(resultText) as AnswerWithEmotion;
}
