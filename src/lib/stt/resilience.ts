/**
 * Resilience utilities for STT system
 * Implements circuit breaker, retry logic, and automatic recovery
 */

export interface RetryConfig {
	readonly maxAttempts: number;
	readonly baseDelayMs: number;
	readonly maxDelayMs: number;
	readonly backoffMultiplier: number;
	readonly jitterMs: number;
}

export interface CircuitBreakerConfig {
	readonly failureThreshold: number;
	readonly resetTimeoutMs: number;
	readonly monitoringWindowMs: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
	readonly state: CircuitState;
	readonly failureCount: number;
	readonly lastFailureTime?: number;
	readonly lastSuccessTime?: number;
	readonly totalAttempts: number;
	readonly successCount: number;
}

export class CircuitBreaker {
	private state: CircuitState = 'CLOSED';
	private failureCount = 0;
	private lastFailureTime?: number;
	private lastSuccessTime?: number;
	private totalAttempts = 0;
	private successCount = 0;
	private readonly config: Required<CircuitBreakerConfig>;

	constructor(config: Partial<CircuitBreakerConfig> = {}) {
		this.config = {
			failureThreshold: config.failureThreshold ?? 5,
			resetTimeoutMs: config.resetTimeoutMs ?? 60000, // 1 minute
			monitoringWindowMs: config.monitoringWindowMs ?? 300000 // 5 minutes
		};

		this.validateConfig();
	}

	private validateConfig(): void {
		const { failureThreshold, resetTimeoutMs, monitoringWindowMs } = this.config;

		if (failureThreshold < 1) {
			throw new Error(`Invalid failureThreshold: ${failureThreshold}. Must be at least 1`);
		}

		if (resetTimeoutMs < 1000) {
			throw new Error(`Invalid resetTimeoutMs: ${resetTimeoutMs}. Must be at least 1000ms`);
		}

		if (monitoringWindowMs < resetTimeoutMs) {
			throw new Error(
				`monitoringWindowMs (${monitoringWindowMs}) must be >= resetTimeoutMs (${resetTimeoutMs})`
			);
		}
	}

	async execute<T>(operation: () => Promise<T>, context: string): Promise<T> {
		this.totalAttempts++;

		if (this.state === 'OPEN') {
			if (this.shouldAttemptReset()) {
				console.log(`[CircuitBreaker] Attempting reset for ${context}`, {
					lastFailureTime: this.lastFailureTime,
					timeSinceFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : 'N/A',
					timestamp: new Date().toISOString()
				});
				this.state = 'HALF_OPEN';
			} else {
				const error = new Error(
					`Circuit breaker is OPEN for ${context}. Service temporarily unavailable`
				);
				console.warn(`[CircuitBreaker] Rejecting request - circuit OPEN`, {
					context,
					failureCount: this.failureCount,
					lastFailureTime: this.lastFailureTime,
					timestamp: new Date().toISOString()
				});
				throw error;
			}
		}

		try {
			const result = await operation();
			this.onSuccess(context);
			return result;
		} catch (error) {
			this.onFailure(error, context);
			throw error;
		}
	}

	private shouldAttemptReset(): boolean {
		if (!this.lastFailureTime) return false;
		return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
	}

	private onSuccess(context: string): void {
		this.successCount++;
		this.lastSuccessTime = Date.now();

		if (this.state === 'HALF_OPEN') {
			console.log(`[CircuitBreaker] Success in HALF_OPEN state, closing circuit for ${context}`, {
				successCount: this.successCount,
				timestamp: new Date().toISOString()
			});
			this.state = 'CLOSED';
			this.failureCount = 0;
		}
	}

	private onFailure(error: unknown, context: string): void {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		console.error(`[CircuitBreaker] Failure recorded for ${context}`, {
			failureCount: this.failureCount,
			threshold: this.config.failureThreshold,
			error: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		});

		if (this.failureCount >= this.config.failureThreshold) {
			console.warn(`[CircuitBreaker] Opening circuit for ${context}`, {
				failureCount: this.failureCount,
				threshold: this.config.failureThreshold,
				resetTimeoutMs: this.config.resetTimeoutMs,
				timestamp: new Date().toISOString()
			});
			this.state = 'OPEN';
		}
	}

	getState(): CircuitBreakerState {
		return {
			state: this.state,
			failureCount: this.failureCount,
			lastFailureTime: this.lastFailureTime,
			lastSuccessTime: this.lastSuccessTime,
			totalAttempts: this.totalAttempts,
			successCount: this.successCount
		};
	}

	reset(): void {
		console.log('[CircuitBreaker] Manual reset requested', {
			previousState: this.state,
			failureCount: this.failureCount,
			timestamp: new Date().toISOString()
		});

		this.state = 'CLOSED';
		this.failureCount = 0;
		this.lastFailureTime = undefined;
	}
}

export class RetryManager {
	private readonly config: Required<RetryConfig>;

	constructor(config: Partial<RetryConfig> = {}) {
		this.config = {
			maxAttempts: config.maxAttempts ?? 3,
			baseDelayMs: config.baseDelayMs ?? 1000,
			maxDelayMs: config.maxDelayMs ?? 10000,
			backoffMultiplier: config.backoffMultiplier ?? 2,
			jitterMs: config.jitterMs ?? 100
		};

		this.validateConfig();
	}

	private validateConfig(): void {
		const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = this.config;

		if (maxAttempts < 1) {
			throw new Error(`Invalid maxAttempts: ${maxAttempts}. Must be at least 1`);
		}

		if (baseDelayMs < 0) {
			throw new Error(`Invalid baseDelayMs: ${baseDelayMs}. Must be non-negative`);
		}

		if (maxDelayMs < baseDelayMs) {
			throw new Error(`maxDelayMs (${maxDelayMs}) must be >= baseDelayMs (${baseDelayMs})`);
		}

		if (backoffMultiplier < 1) {
			throw new Error(`Invalid backoffMultiplier: ${backoffMultiplier}. Must be at least 1`);
		}
	}

	async executeWithRetry<T>(
		operation: () => Promise<T>,
		context: string,
		isRetryableError: (error: unknown) => boolean = () => true
	): Promise<T> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				console.log(
					`[RetryManager] Attempting ${context} (${attempt}/${this.config.maxAttempts})`,
					{
						timestamp: new Date().toISOString()
					}
				);

				const result = await operation();

				if (attempt > 1) {
					console.log(`[RetryManager] Success on attempt ${attempt} for ${context}`, {
						totalAttempts: attempt,
						timestamp: new Date().toISOString()
					});
				}

				return result;
			} catch (error) {
				lastError = error;

				console.warn(
					`[RetryManager] Attempt ${attempt}/${this.config.maxAttempts} failed for ${context}`,
					{
						error: error instanceof Error ? error.message : 'Unknown error',
						isRetryable: isRetryableError(error),
						timestamp: new Date().toISOString()
					}
				);

				// Don't retry if error is not retryable or this was the last attempt
				if (!isRetryableError(error) || attempt === this.config.maxAttempts) {
					break;
				}

				// Calculate delay with exponential backoff and jitter
				const delay = this.calculateDelay(attempt);
				console.log(`[RetryManager] Waiting ${delay}ms before retry ${attempt + 1}`, {
					context,
					timestamp: new Date().toISOString()
				});

				await this.sleep(delay);
			}
		}

		const finalError = new Error(
			`All ${this.config.maxAttempts} attempts failed for ${context}: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
		);
		console.error(`[RetryManager] Final failure for ${context}`, {
			totalAttempts: this.config.maxAttempts,
			finalError: finalError.message,
			timestamp: new Date().toISOString()
		});

		throw finalError;
	}

	private calculateDelay(attempt: number): number {
		const exponentialDelay =
			this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
		const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
		const jitter = Math.random() * this.config.jitterMs;
		return Math.round(cappedDelay + jitter);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	getConfig(): Required<RetryConfig> {
		return { ...this.config };
	}
}

export class ResilientOperationManager {
	private readonly circuitBreaker: CircuitBreaker;
	private readonly retryManager: RetryManager;

	constructor(
		circuitBreakerConfig: Partial<CircuitBreakerConfig> = {},
		retryConfig: Partial<RetryConfig> = {}
	) {
		this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
		this.retryManager = new RetryManager(retryConfig);
	}

	async execute<T>(
		operation: () => Promise<T>,
		context: string,
		isRetryableError: (error: unknown) => boolean = (error) => {
			// Default: retry on network errors, timeouts, and temporary failures
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				return (
					message.includes('network') ||
					message.includes('timeout') ||
					message.includes('temporary') ||
					message.includes('unavailable') ||
					message.includes('connection')
				);
			}
			return false;
		}
	): Promise<T> {
		return this.circuitBreaker.execute(async () => {
			return this.retryManager.executeWithRetry(operation, context, isRetryableError);
		}, context);
	}

	getCircuitBreakerState(): CircuitBreakerState {
		return this.circuitBreaker.getState();
	}

	getRetryConfig(): Required<RetryConfig> {
		return this.retryManager.getConfig();
	}

	resetCircuitBreaker(): void {
		this.circuitBreaker.reset();
	}
}
