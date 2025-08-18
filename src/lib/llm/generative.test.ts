import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateStructuredOutput, generateAnswerWithEmotion } from './generative';

// Mock the GoogleGenerativeAI
vi.mock('@google/generative-ai', () => ({
	GoogleGenerativeAI: vi.fn()
}));

// Mock the sleep function to avoid timeouts
vi.mock('$lib/utils/sleep', () => ({
	sleep: vi.fn().mockResolvedValue(undefined)
}));

describe('Generative AI Functions', () => {
	let mockGenerativeAI: any;
	let mockModel: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockModel = {
			generateContent: vi.fn()
		};

		mockGenerativeAI = {
			getGenerativeModel: vi.fn().mockReturnValue(mockModel)
		};

		(GoogleGenerativeAI as any).mockImplementation(() => mockGenerativeAI);
	});

	describe('generateStructuredOutput', () => {
		const mockSchema = {
			type: 'object',
			properties: {
				answer: { type: 'string' }
			}
		};

		it('should generate content successfully on first attempt', async () => {
			const mockResponse = {
				response: {
					text: () => '{"answer": "test response"}'
				}
			};
			mockModel.generateContent.mockResolvedValue(mockResponse);

			const result = await generateStructuredOutput(
				mockGenerativeAI,
				'system instruction',
				'test prompt',
				mockSchema
			);

			expect(result).toBe('{"answer": "test response"}');
			expect(mockGenerativeAI.getGenerativeModel).toHaveBeenCalledWith({
				model: 'gemini-2.0-flash',
				generationConfig: {
					responseMimeType: 'application/json',
					responseSchema: mockSchema,
					maxOutputTokens: 64000
				},
				systemInstruction: 'system instruction'
			});
			expect(mockModel.generateContent).toHaveBeenCalledWith('test prompt');
		});

		it('should retry on 503 errors with exponential backoff', async () => {
			const error503 = { status: 503, message: 'Service unavailable' };
			const mockResponse = {
				response: {
					text: () => '{"answer": "success after retry"}'
				}
			};

			mockModel.generateContent
				.mockRejectedValueOnce(error503)
				.mockRejectedValueOnce(error503)
				.mockResolvedValueOnce(mockResponse);

			const result = await generateStructuredOutput(
				mockGenerativeAI,
				'system instruction',
				'test prompt',
				mockSchema,
				5
			);

			expect(result).toBe('{"answer": "success after retry"}');
			expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
		});

		it('should throw error after max retries', async () => {
			const error = new Error('Persistent error');
			mockModel.generateContent.mockRejectedValue(error);

			await expect(
				generateStructuredOutput(
					mockGenerativeAI,
					'system instruction',
					'test prompt',
					mockSchema,
					1
				)
			).rejects.toThrow('Persistent error');

			expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
		});

		it('should not retry on non-503 errors', async () => {
			const error400 = { status: 400, message: 'Bad request' };
			mockModel.generateContent.mockRejectedValue(error400);

			await expect(
				generateStructuredOutput(
					mockGenerativeAI,
					'system instruction',
					'test prompt',
					mockSchema,
					3
				)
			).rejects.toEqual(error400);

			expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
		});
	});

	describe('generateAnswerWithEmotion', () => {
		it('should generate answer with emotion successfully', async () => {
			const mockResponse = {
				response: {
					text: () => '{"answer": "I am happy!", "emotion": "happy"}'
				}
			};
			mockModel.generateContent.mockResolvedValue(mockResponse);

			const result = await generateAnswerWithEmotion(
				mockGenerativeAI,
				'system instruction',
				'tell me a joke'
			);

			expect(result).toEqual({ answer: 'I am happy!', emotion: 'happy' });
			expect(mockGenerativeAI.getGenerativeModel).toHaveBeenCalled();
		});

		it('should handle malformed JSON response', async () => {
			const mockResponse = {
				response: {
					text: () => 'invalid json'
				}
			};
			mockModel.generateContent.mockResolvedValue(mockResponse);

			await expect(
				generateAnswerWithEmotion(mockGenerativeAI, 'system instruction', 'test prompt')
			).rejects.toThrow();
		});

		it('should use correct schema for emotion detection', async () => {
			const mockResponse = {
				response: {
					text: () => '{"answer": "test", "emotion": "neutral"}'
				}
			};
			mockModel.generateContent.mockResolvedValue(mockResponse);

			await generateAnswerWithEmotion(mockGenerativeAI, 'system instruction', 'test prompt');

			const expectedSchema = {
				type: 'object',
				properties: {
					answer: {
						type: 'string',
						description: 'The textual answer to the prompt.'
					},
					emotion: {
						type: 'string',
						enum: ['angry', 'happy', 'neutral', 'funny'],
						description:
							'The dominant emotion conveyed in the answer (angry, happy, neutral, funny).'
					}
				},
				required: ['answer', 'emotion']
			};

			expect(mockGenerativeAI.getGenerativeModel).toHaveBeenCalledWith(
				expect.objectContaining({
					generationConfig: expect.objectContaining({
						responseSchema: expectedSchema
					})
				})
			);
		});
	});
});
