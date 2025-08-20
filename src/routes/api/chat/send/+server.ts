import type { ChatMessage } from '$lib/types/chat';
import { json } from '@sveltejs/kit';
import { UnifiedLLMClient } from '$lib/llm/client';
import { dev } from '$app/environment';
// Note: Logging and error handling utilities available for future enhancement

// Constants for LLM interaction
const SYSTEM_PROMPT =
	'You are EMO, a character who is deeply introspective and sensitive. You often feel misunderstood and express yourself with a touch of melancholy and poetic flair. Respond to user inputs in a way that is consistent with your persona: thoughtful, a bit reserved, and with a hint of poetic sadness or depth. Keep your responses relatively concise for a live interaction, but let your emotions show.';

const RESPONSE_SCHEMA_OBJECT = {
	type: 'object',
	properties: {
		reply: { type: 'string' }
	},
	required: ['reply']
};

// Rate Limiting (in-memory, basic)
const userRequestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 messages per minute per IP

if (dev)
	console.log('[API Send] LLM Client will be initialized per request with configured provider.');

export async function POST({
	request,
	getClientAddress
}: {
	request: Request;
	getClientAddress: () => string;
}) {
	const clientIp = getClientAddress();
	if (dev) console.log(`[API Send] POST request received from IP: ${clientIp}`);

	const now = Date.now();
	const timestamps = userRequestTimestamps.get(clientIp) || [];
	const recentTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

	if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
		if (dev)
			console.warn(
				`[API Send] Rate limit exceeded for IP: ${clientIp}. Requests in window: ${recentTimestamps.length}`
			);
		return json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
	}
	recentTimestamps.push(now);
	userRequestTimestamps.set(clientIp, recentTimestamps);
	if (dev)
		console.log(
			`[API Send] Rate limit check passed for IP: ${clientIp}. Requests in window: ${recentTimestamps.length}`
		);

	let requestData: { message: string };
	try {
		requestData = await request.json();
		if (dev) console.log('[API Send] Request body parsed:', requestData);
		if (
			!requestData.message ||
			typeof requestData.message !== 'string' ||
			requestData.message.trim() === ''
		) {
			if (dev) console.warn('[API Send] Invalid message content in request.', requestData);
			return json({ error: 'Invalid message content.' }, { status: 400 });
		}
	} catch (error: unknown) {
		if (dev) console.error('[API Send] Error parsing request body:', error);
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const { message: userMessageContent } = requestData;
	if (dev)
		console.log(
			`[API Send] Processing message from Anonymous: "${userMessageContent.substring(0, 50)}..."`
		);

	const userChatMessage: ChatMessage = {
		id: crypto.randomUUID(),
		role: 'user',
		content: userMessageContent.trim(),
		timestamp: Date.now()
	};
	if (dev) console.log('[API Send] Processing user message with ID:', userChatMessage.id);

	try {
		if (dev) console.log('[API Send] Starting LLM chat for message ID:', userChatMessage.id);

		const llmClient = new UnifiedLLMClient();
		const messages = [
			{ role: 'system' as const, content: SYSTEM_PROMPT },
			{ role: 'user' as const, content: userMessageContent.trim() }
		];

		let avatarText = "I'm not sure what to say to that.";

		// Try structured output first, fallback to regular chat
		try {
			const responseText = await llmClient.generateStructuredOutput(
				SYSTEM_PROMPT,
				userMessageContent.trim(),
				RESPONSE_SCHEMA_OBJECT
			);

			if (dev)
				console.log(
					'[API Send] LLM response received raw text:',
					responseText.substring(0, 100) + '...'
				);

			const parsedResponse = JSON.parse(responseText);
			if (parsedResponse && parsedResponse.reply && typeof parsedResponse.reply === 'string') {
				avatarText = parsedResponse.reply;
				if (dev)
					console.log(
						'[API Send] LLM reply parsed successfully:',
						avatarText.substring(0, 50) + '...'
					);
			} else {
				if (dev)
					console.warn(
						'[API Send] LLM response JSON did not contain a valid .reply string. Raw response:',
						responseText
					);
			}
		} catch (e) {
			// Fallback to regular chat if structured output fails
			if (dev) console.log('[API Send] Structured output failed, falling back to regular chat:', e);

			const chatResponse = await llmClient.chat(messages);
			avatarText = chatResponse.content;

			if (dev)
				console.log('[API Send] Chat fallback response:', avatarText.substring(0, 50) + '...');
		}

		const avatarChatMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'avatar',
			content: avatarText,
			timestamp: Date.now()
		};
		if (dev)
			console.log(
				'[API Send] Generated avatar message ID:',
				avatarChatMessage.id,
				'Content:',
				avatarText.substring(0, 50) + '...'
			);

		// Return the avatar message directly instead of broadcasting
		return json(
			{
				success: true,
				userMessage: userChatMessage.content, // Just return the text content
				avatarMessage: avatarText // Return avatar response text directly
			},
			{ status: 200 }
		);
	} catch (error: unknown) {
		if (dev)
			console.error(
				'[API Send] Error during LLM interaction or broadcasting avatar message:',
				error
			);
		let errorMessage = "Sorry, I'm having a bit of trouble thinking right now.";
		if (error instanceof Error && error.message && typeof error.message === 'string') {
			if (error.message.includes('API key') || error.message.includes('Google')) {
				errorMessage =
					'There seems to be an issue with my connection to my thoughts (AI service). Please try again later.';
			} else if (error.message.includes('JSON')) {
				errorMessage = "I received a thought that I couldn't quite understand (invalid format).";
			} else if (error.message.includes('Unsupported provider')) {
				errorMessage =
					'My thinking mechanism is misconfigured. Please check the LLM provider settings.';
			} else if (error.message.toLowerCase().includes('connection')) {
				errorMessage =
					'I cannot reach my local AI service. Please ensure Ollama or LM Studio is running if configured.';
			}
		}

		const errorAvatarMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'avatar',
			content: errorMessage,
			timestamp: Date.now()
		};
		if (dev)
			console.log('[API Send] Generated error message from avatar. ID:', errorAvatarMessage.id);

		return json(
			{
				error: 'Failed to get avatar response.',
				details: error instanceof Error ? error.message : 'Unknown error',
				avatarMessage: errorMessage // Return error message directly so it can still be spoken
			},
			{ status: 500 }
		);
	}
}
