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
			description:
				'The textual answer to the prompt in English language only. Never use non-English languages or characters.'
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
	maxRetries = 3
): Promise<AnswerWithEmotion> {
	// Enhanced system instruction with multiple English-only constraints
	const modifiedSystemInstruction = `${systemInstruction} 

CRITICAL LANGUAGE REQUIREMENTS:
- You MUST respond ONLY in English language
- Never use Chinese, Japanese, Korean, Arabic, Russian, or any non-English characters
- Use only Latin alphabet (A-Z, a-z), numbers (0-9), and standard punctuation
- If user writes in another language, still respond in English only

When determining the emotion for your answer, consider the sentiment of the user's prompt. For example, if the user's prompt is aggressive, negative, or insulting, your answer's emotion should reflect an appropriate response, such as 'angry'. Conversely, if the prompt is positive or inquisitive, choose a corresponding emotion.`;

	// Log user prompt for debugging
	console.log('[LLM] Processing user prompt:', prompt.substring(0, 100));

	// Generate response with simplified validation
	const resultText = await generateStructuredOutput(
		llmClient,
		modifiedSystemInstruction,
		prompt,
		answerEmotionSchema,
		maxRetries
	);

	let parsedResponse;
	try {
		parsedResponse = JSON.parse(resultText);
	} catch {
		// Try to fix common JSON syntax errors and extract valid JSON
		let cleanedJson = resultText;

		// Extract JSON object if there's extra content
		const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			cleanedJson = jsonMatch[0];
		}

		// Fix missing comma between answer and emotion fields
		cleanedJson = cleanedJson.replace(/"\s*\n\s*"emotion"/, '",\n  "emotion"');
		cleanedJson = cleanedJson.replace(/"\s+"emotion"/, '", "emotion"');

		try {
			parsedResponse = JSON.parse(cleanedJson);
		} catch {
			return {
				answer: "Sorry, I'm having trouble thinking right now.",
				emotion: 'neutral'
			};
		}
	}

	// Handle different response formats from different LLM providers
	let response: AnswerWithEmotion;

	// Check if response is in schema format (from LM Studio/non-Google providers)
	if (
		parsedResponse.properties &&
		parsedResponse.properties.answer &&
		parsedResponse.properties.emotion
	) {
		response = {
			answer: parsedResponse.properties.answer,
			emotion: parsedResponse.properties.emotion
		};
	}
	// Check if response is direct format (from Google/proper structured output)
	else if (parsedResponse.answer && parsedResponse.emotion) {
		response = parsedResponse as AnswerWithEmotion;
	}
	// Invalid format
	else {
		console.warn('[LLM] Invalid response structure, using fallback');
		console.warn('[LLM] Response object:', parsedResponse);
		return {
			answer: "I'm having trouble processing your request right now. Could you please try again?",
			emotion: 'neutral'
		};
	}

	// Validate that we now have proper fields
	if (!response.answer || typeof response.answer !== 'string') {
		console.warn('[LLM] Still invalid after parsing, using fallback');
		console.warn('[LLM] Response object:', response);
		return {
			answer: "I'm having trouble processing your request right now. Could you please try again?",
			emotion: 'neutral'
		};
	}

	// Simplified validation - only check for obvious non-English scripts
	const hasNonEnglishChars =
		/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff]/.test(
			response.answer
		);
	if (hasNonEnglishChars) {
		console.warn('[LLM] Non-English characters detected in response, using fallback');
		return {
			answer:
				"I'm having trouble expressing my thoughts clearly right now. Could you rephrase your question?",
			emotion: response.emotion || 'neutral'
		};
	}

	console.log('[LLM] Response generated successfully:', response.answer.substring(0, 100) + '...');
	return response;
}
