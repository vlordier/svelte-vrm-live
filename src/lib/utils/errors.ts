import { createModuleLogger } from './logger';

const log = createModuleLogger('ErrorHandler');

/**
 * Custom error classes for better error categorization
 */
export class AppError extends Error {
	public readonly isOperational: boolean;
	public readonly statusCode: number;
	public readonly context?: Record<string, unknown>;

	constructor(
		message: string,
		statusCode: number = 500,
		isOperational: boolean = true,
		context?: Record<string, unknown>
	) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.context = context;

		Error.captureStackTrace(this, this.constructor);
	}
}

export class ValidationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 400, true, context);
	}
}

export class AuthenticationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 401, true, context);
	}
}

export class AuthorizationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 403, true, context);
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, context?: Record<string, unknown>) {
		super(`${resource} not found`, 404, true, context);
	}
}

export class ExternalServiceError extends AppError {
	constructor(service: string, message: string, context?: Record<string, unknown>) {
		super(`External service error (${service}): ${message}`, 502, true, context);
	}
}

export class TTSError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(`TTS Error: ${message}`, 500, true, { service: 'tts', ...context });
	}
}

export class LLMError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(`LLM Error: ${message}`, 500, true, { service: 'llm', ...context });
	}
}

export class VRMError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(`VRM Error: ${message}`, 500, true, { service: 'vrm', ...context });
	}
}

/**
 * Error handling utilities
 */
export const errorHandling = {
	/**
	 * Safely execute an async function with error handling
	 */
	async safeExecute<T>(
		fn: () => Promise<T>,
		context?: { operation?: string; fallback?: T }
	): Promise<T | null> {
		try {
			log.time(context?.operation || 'operation');
			const result = await fn();
			log.timeEnd(context?.operation || 'operation');
			return result;
		} catch (error) {
			log.error(`Error in ${context?.operation || 'operation'}`, error);
			return context?.fallback ?? null;
		}
	},

	/**
	 * Retry function with exponential backoff
	 */
	async withRetry<T>(
		fn: () => Promise<T>,
		options: {
			maxAttempts?: number;
			baseDelay?: number;
			maxDelay?: number;
			operation?: string;
		} = {}
	): Promise<T> {
		const {
			maxAttempts = 3,
			baseDelay = 1000,
			maxDelay = 10000,
			operation = 'operation'
		} = options;

		let lastError: Error | unknown;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				log.debug(`Attempting ${operation} (${attempt}/${maxAttempts})`);
				return await fn();
			} catch (error) {
				lastError = error;

				if (attempt === maxAttempts) {
					log.error(`Final attempt failed for ${operation}`, error);
					break;
				}

				const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
				log.warn(`Attempt ${attempt} failed for ${operation}, retrying in ${delay}ms`, { error });

				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new AppError(`Operation ${operation} failed after ${maxAttempts} attempts`, 500, true, {
			lastError,
			maxAttempts
		});
	},

	/**
	 * Check if error is operational (safe to expose to client)
	 */
	isOperational(error: unknown): boolean {
		if (error instanceof AppError) {
			return error.isOperational;
		}
		return false;
	},

	/**
	 * Get safe error message for client
	 */
	getSafeErrorMessage(error: unknown): string {
		if (error instanceof AppError && error.isOperational) {
			return error.message;
		}

		if (error instanceof Error) {
			// Check for specific known safe patterns
			if (error.message.includes('fetch') || error.message.includes('network')) {
				return 'Network error occurred. Please try again.';
			}
			if (error.message.includes('timeout')) {
				return 'Request timed out. Please try again.';
			}
		}

		return 'An unexpected error occurred. Please try again.';
	},

	/**
	 * Log and format error for API responses
	 */
	handleApiError(
		error: unknown,
		context?: Record<string, unknown>
	): {
		message: string;
		statusCode: number;
		context?: Record<string, unknown>;
	} {
		log.error('API Error occurred', error, context);

		if (error instanceof AppError) {
			return {
				message: error.isOperational ? error.message : this.getSafeErrorMessage(error),
				statusCode: error.statusCode,
				context: error.context
			};
		}

		return {
			message: this.getSafeErrorMessage(error),
			statusCode: 500,
			context
		};
	}
};

/**
 * Async error boundary for Svelte components
 */
export const createErrorBoundary = (component: string) => {
	const componentLog = createModuleLogger(`Component:${component}`);

	return {
		async wrap<T>(fn: () => Promise<T>, operation: string): Promise<T | null> {
			try {
				componentLog.debug(`Starting ${operation}`);
				const result = await fn();
				componentLog.debug(`Completed ${operation}`);
				return result;
			} catch (error) {
				componentLog.error(`Error in ${operation}`, error);
				// In a real app, you might want to show a toast notification here
				return null;
			}
		},

		handleError(error: unknown, operation: string): void {
			componentLog.error(`Unhandled error in ${operation}`, error);
		}
	};
};
