import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateStructuredOutput, generateAnswerWithEmotion } from './generative';
import { UnifiedLLMClient } from './client';

// Mock the UnifiedLLMClient
vi.mock('./client', () => ({
	UnifiedLLMClient: vi.fn()
}));

describe('Generative AI Functions', () => {
	let mockLLMClient: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockLLMClient = {
			generateStructuredOutput: vi.fn(),
			generateText: vi.fn(),
			chat: vi.fn()
		};

		(UnifiedLLMClient as any).mockImplementation(() => mockLLMClient);
	});

	describe('generateStructuredOutput', () => {
		const mockSchema = {
			type: 'object',
			properties: {
				answer: { type: 'string' }
			}
		};

		it('should generate content successfully', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue('{"answer": "test response"}');

			const result = await generateStructuredOutput(
				mockLLMClient,
				'system instruction',
				'test prompt',
				mockSchema
			);

			expect(result).toBe('{"answer": "test response"}');
			expect(mockLLMClient.generateStructuredOutput).toHaveBeenCalledWith(
				'system instruction',
				'test prompt',
				mockSchema,
				10
			);
		});

		it('should pass maxRetries parameter', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue('{"answer": "test response"}');

			await generateStructuredOutput(
				mockLLMClient,
				'system instruction',
				'test prompt',
				mockSchema,
				5
			);

			expect(mockLLMClient.generateStructuredOutput).toHaveBeenCalledWith(
				'system instruction',
				'test prompt',
				mockSchema,
				5
			);
		});

		it('should throw error if client throws', async () => {
			const error = new Error('Client error');
			mockLLMClient.generateStructuredOutput.mockRejectedValue(error);

			await expect(
				generateStructuredOutput(mockLLMClient, 'system instruction', 'test prompt', mockSchema, 1)
			).rejects.toThrow('Client error');
		});
	});

	describe('generateAnswerWithEmotion', () => {
		it('should generate answer with emotion successfully', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue(
				'{"answer": "I am happy!", "emotion": "happy"}'
			);

			const result = await generateAnswerWithEmotion(
				mockLLMClient,
				'system instruction',
				'tell me a joke'
			);

			expect(result).toEqual({ answer: 'I am happy!', emotion: 'happy' });
			expect(mockLLMClient.generateStructuredOutput).toHaveBeenCalledWith(
				expect.stringContaining('system instruction'),
				'tell me a joke',
				expect.objectContaining({
					type: 'object',
					properties: expect.objectContaining({
						answer: expect.objectContaining({
							type: 'string',
							description: 'The textual answer to the prompt.'
						}),
						emotion: expect.objectContaining({
							type: 'string',
							enum: ['angry', 'happy', 'neutral', 'funny']
						})
					}),
					required: ['answer', 'emotion']
				}),
				10
			);
		});

		it('should handle malformed JSON response', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue('invalid json');

			await expect(
				generateAnswerWithEmotion(mockLLMClient, 'system instruction', 'test prompt')
			).rejects.toThrow();
		});

		it('should modify system instruction for emotion detection', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue(
				'{"answer": "test", "emotion": "neutral"}'
			);

			await generateAnswerWithEmotion(mockLLMClient, 'system instruction', 'test prompt');

			expect(mockLLMClient.generateStructuredOutput).toHaveBeenCalledWith(
				expect.stringContaining('When determining the emotion for your answer'),
				'test prompt',
				expect.any(Object),
				10
			);
		});

		it('should pass maxRetries parameter', async () => {
			mockLLMClient.generateStructuredOutput.mockResolvedValue(
				'{"answer": "test", "emotion": "neutral"}'
			);

			await generateAnswerWithEmotion(mockLLMClient, 'system instruction', 'test prompt', 5);

			expect(mockLLMClient.generateStructuredOutput).toHaveBeenCalledWith(
				expect.any(String),
				'test prompt',
				expect.any(Object),
				5
			);
		});
	});
});
