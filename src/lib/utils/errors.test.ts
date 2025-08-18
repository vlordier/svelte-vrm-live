import { describe, it, expect, vi } from 'vitest';
import {
	AppError,
	ValidationError,
	TTSError,
	LLMError,
	errorHandling,
	createErrorBoundary
} from './errors';

describe('Custom Error Classes', () => {
	describe('AppError', () => {
		it('should create error with correct properties', () => {
			const error = new AppError('Test error', 400, true, { key: 'value' });

			expect(error.message).toBe('Test error');
			expect(error.statusCode).toBe(400);
			expect(error.isOperational).toBe(true);
			expect(error.context).toEqual({ key: 'value' });
			expect(error.name).toBe('AppError');
		});

		it('should have default values', () => {
			const error = new AppError('Test error');

			expect(error.statusCode).toBe(500);
			expect(error.isOperational).toBe(true);
			expect(error.context).toBeUndefined();
		});
	});

	describe('ValidationError', () => {
		it('should create validation error with 400 status', () => {
			const error = new ValidationError('Invalid input');

			expect(error.statusCode).toBe(400);
			expect(error.message).toBe('Invalid input');
			expect(error.isOperational).toBe(true);
		});
	});

	describe('TTSError', () => {
		it('should create TTS error with service context', () => {
			const error = new TTSError('TTS failed');

			expect(error.message).toBe('TTS Error: TTS failed');
			expect(error.context).toEqual({ service: 'tts' });
		});
	});

	describe('LLMError', () => {
		it('should create LLM error with service context', () => {
			const error = new LLMError('LLM failed');

			expect(error.message).toBe('LLM Error: LLM failed');
			expect(error.context).toEqual({ service: 'llm' });
		});
	});
});

describe('Error Handling Utilities', () => {
	describe('safeExecute', () => {
		it('should return result on success', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');

			const result = await errorHandling.safeExecute(mockFn);

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalled();
		});

		it('should return null on error', async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

			const result = await errorHandling.safeExecute(mockFn);

			expect(result).toBeNull();
		});

		it('should return fallback value on error', async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
			const fallback = 'fallback';

			const result = await errorHandling.safeExecute(mockFn, { fallback });

			expect(result).toBe(fallback);
		});
	});

	describe('withRetry', () => {
		it('should succeed on first attempt', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');

			const result = await errorHandling.withRetry(mockFn, { maxAttempts: 3 });

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should retry on failure and eventually succeed', async () => {
			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new Error('fail 1'))
				.mockRejectedValueOnce(new Error('fail 2'))
				.mockResolvedValueOnce('success');

			const result = await errorHandling.withRetry(mockFn, { maxAttempts: 3, baseDelay: 10 });

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('should throw AppError after max attempts', async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error('always fails'));

			await expect(
				errorHandling.withRetry(mockFn, { maxAttempts: 2, baseDelay: 10 })
			).rejects.toThrow(AppError);

			expect(mockFn).toHaveBeenCalledTimes(2);
		});
	});

	describe('isOperational', () => {
		it('should return true for operational AppError', () => {
			const error = new AppError('test', 400, true);

			expect(errorHandling.isOperational(error)).toBe(true);
		});

		it('should return false for non-operational AppError', () => {
			const error = new AppError('test', 500, false);

			expect(errorHandling.isOperational(error)).toBe(false);
		});

		it('should return false for regular Error', () => {
			const error = new Error('test');

			expect(errorHandling.isOperational(error)).toBe(false);
		});
	});

	describe('getSafeErrorMessage', () => {
		it('should return message for operational AppError', () => {
			const error = new AppError('Safe error message', 400, true);

			expect(errorHandling.getSafeErrorMessage(error)).toBe('Safe error message');
		});

		it('should return generic message for non-operational AppError', () => {
			const error = new AppError('Internal error', 500, false);

			expect(errorHandling.getSafeErrorMessage(error)).toBe(
				'An unexpected error occurred. Please try again.'
			);
		});

		it('should return network error message for fetch errors', () => {
			const error = new Error('fetch failed');

			expect(errorHandling.getSafeErrorMessage(error)).toBe(
				'Network error occurred. Please try again.'
			);
		});

		it('should return timeout message for timeout errors', () => {
			const error = new Error('timeout exceeded');

			expect(errorHandling.getSafeErrorMessage(error)).toBe('Request timed out. Please try again.');
		});
	});

	describe('handleApiError', () => {
		it('should handle operational AppError correctly', () => {
			const error = new AppError('Validation failed', 400, true, { field: 'email' });

			const result = errorHandling.handleApiError(error);

			expect(result).toEqual({
				message: 'Validation failed',
				statusCode: 400,
				context: { field: 'email' }
			});
		});

		it('should handle non-operational AppError safely', () => {
			const error = new AppError('Internal system error', 500, false);

			const result = errorHandling.handleApiError(error);

			expect(result).toEqual({
				message: 'An unexpected error occurred. Please try again.',
				statusCode: 500,
				context: undefined
			});
		});

		it('should handle regular Error safely', () => {
			const error = new Error('Database connection failed');

			const result = errorHandling.handleApiError(error);

			expect(result).toEqual({
				message: 'An unexpected error occurred. Please try again.',
				statusCode: 500,
				context: undefined
			});
		});
	});
});

describe('Error Boundary', () => {
	it('should wrap async function and return result on success', async () => {
		const boundary = createErrorBoundary('TestComponent');
		const mockFn = vi.fn().mockResolvedValue('success');

		const result = await boundary.wrap(mockFn, 'test operation');

		expect(result).toBe('success');
		expect(mockFn).toHaveBeenCalled();
	});

	it('should wrap async function and return null on error', async () => {
		const boundary = createErrorBoundary('TestComponent');
		const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

		const result = await boundary.wrap(mockFn, 'test operation');

		expect(result).toBeNull();
	});

	it('should handle errors without throwing', () => {
		const boundary = createErrorBoundary('TestComponent');
		const error = new Error('test error');

		expect(() => {
			boundary.handleError(error, 'test operation');
		}).not.toThrow();
	});
});
