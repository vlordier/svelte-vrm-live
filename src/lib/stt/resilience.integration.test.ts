import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, RetryManager, ResilientOperationManager } from './resilience';

describe('Resilience System Integration Tests', () => {
	describe('CircuitBreaker', () => {
		let circuitBreaker: CircuitBreaker;

		beforeEach(() => {
			circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringWindowMs: 5000
			});
		});

		it('should start in CLOSED state', () => {
			const state = circuitBreaker.getState();
			expect(state.state).toBe('CLOSED');
			expect(state.failureCount).toBe(0);
		});

		it('should open circuit after threshold failures', async () => {
			const failingOperation = async () => {
				throw new Error('Test failure');
			};

			// Execute failing operations to reach threshold
			for (let i = 0; i < 3; i++) {
				try {
					await circuitBreaker.execute(failingOperation, 'test-operation');
				} catch (error) {
					// Expected to fail
				}
			}

			const state = circuitBreaker.getState();
			expect(state.state).toBe('OPEN');
			expect(state.failureCount).toBe(3);
		});

		it('should reject requests when circuit is OPEN', async () => {
			const failingOperation = async () => {
				throw new Error('Test failure');
			};

			// Open the circuit
			for (let i = 0; i < 3; i++) {
				try {
					await circuitBreaker.execute(failingOperation, 'test-operation');
				} catch (error) {
					// Expected to fail
				}
			}

			// Now circuit should be OPEN and reject immediately
			await expect(circuitBreaker.execute(async () => 'success', 'test-operation')).rejects.toThrow(
				'Circuit breaker is OPEN'
			);
		});

		it('should transition to HALF_OPEN after reset timeout', async () => {
			const failingOperation = async () => {
				throw new Error('Test failure');
			};

			// Open the circuit
			for (let i = 0; i < 3; i++) {
				try {
					await circuitBreaker.execute(failingOperation, 'test-operation');
				} catch (error) {
					// Expected to fail
				}
			}

			expect(circuitBreaker.getState().state).toBe('OPEN');

			// Wait for reset timeout
			await new Promise((resolve) => setTimeout(resolve, 1100));

			// Next call should attempt reset (HALF_OPEN)
			try {
				await circuitBreaker.execute(async () => 'success', 'test-operation');
			} catch (error) {
				// May still fail, but state should change
			}

			// Should succeed and close circuit
			const result = await circuitBreaker.execute(async () => 'success', 'test-operation');
			expect(result).toBe('success');
			expect(circuitBreaker.getState().state).toBe('CLOSED');
		});

		it('should validate configuration', () => {
			expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow();
			expect(() => new CircuitBreaker({ resetTimeoutMs: 500 })).toThrow();
			expect(
				() =>
					new CircuitBreaker({
						resetTimeoutMs: 5000,
						monitoringWindowMs: 1000
					})
			).toThrow();
		});
	});

	describe('RetryManager', () => {
		let retryManager: RetryManager;

		beforeEach(() => {
			retryManager = new RetryManager({
				maxAttempts: 3,
				baseDelayMs: 100,
				maxDelayMs: 1000,
				backoffMultiplier: 2,
				jitterMs: 10
			});
		});

		it('should succeed on first attempt if operation succeeds', async () => {
			const successfulOperation = async () => 'success';

			const result = await retryManager.executeWithRetry(successfulOperation, 'test-operation');

			expect(result).toBe('success');
		});

		it('should retry on retryable errors', async () => {
			let attempts = 0;
			const eventuallySuccessfulOperation = async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error('network error');
				}
				return 'success';
			};

			const result = await retryManager.executeWithRetry(
				eventuallySuccessfulOperation,
				'test-operation',
				(error) => error instanceof Error && error.message.includes('network')
			);

			expect(result).toBe('success');
			expect(attempts).toBe(3);
		});

		it('should not retry on non-retryable errors', async () => {
			let attempts = 0;
			const nonRetryableOperation = async () => {
				attempts++;
				throw new Error('invalid input');
			};

			await expect(
				retryManager.executeWithRetry(
					nonRetryableOperation,
					'test-operation',
					(error) => error instanceof Error && error.message.includes('network')
				)
			).rejects.toThrow('invalid input');

			expect(attempts).toBe(1);
		});

		it('should fail after max attempts with retryable error', async () => {
			let attempts = 0;
			const alwaysFailingOperation = async () => {
				attempts++;
				throw new Error('network error');
			};

			await expect(
				retryManager.executeWithRetry(
					alwaysFailingOperation,
					'test-operation',
					(error) => error instanceof Error && error.message.includes('network')
				)
			).rejects.toThrow('All 3 attempts failed');

			expect(attempts).toBe(3);
		});

		it('should validate configuration', () => {
			expect(() => new RetryManager({ maxAttempts: 0 })).toThrow();
			expect(() => new RetryManager({ baseDelayMs: -1 })).toThrow();
			expect(
				() =>
					new RetryManager({
						baseDelayMs: 1000,
						maxDelayMs: 500
					})
			).toThrow();
			expect(() => new RetryManager({ backoffMultiplier: 0.5 })).toThrow();
		});
	});

	describe('ResilientOperationManager', () => {
		let resilientOps: ResilientOperationManager;

		beforeEach(() => {
			resilientOps = new ResilientOperationManager(
				{ failureThreshold: 2, resetTimeoutMs: 1000 },
				{ maxAttempts: 2, baseDelayMs: 50 }
			);
		});

		it('should combine circuit breaker and retry logic', async () => {
			let attempts = 0;
			const eventuallySuccessfulOperation = async () => {
				attempts++;
				if (attempts === 1) {
					throw new Error('temporary network error');
				}
				return 'success';
			};

			const result = await resilientOps.execute(eventuallySuccessfulOperation, 'test-operation');

			expect(result).toBe('success');
			expect(attempts).toBe(2);
		});

		it('should open circuit after repeated failures', async () => {
			const alwaysFailingOperation = async () => {
				throw new Error('network error');
			};

			// First set of failures to open circuit
			for (let i = 0; i < 2; i++) {
				try {
					await resilientOps.execute(alwaysFailingOperation, 'test-operation');
				} catch (error) {
					// Expected to fail
				}
			}

			const state = resilientOps.getCircuitBreakerState();
			expect(state.state).toBe('OPEN');

			// Next call should be rejected immediately by circuit breaker
			await expect(resilientOps.execute(async () => 'success', 'test-operation')).rejects.toThrow(
				'Circuit breaker is OPEN'
			);
		});

		it('should allow manual circuit breaker reset', async () => {
			const alwaysFailingOperation = async () => {
				throw new Error('network error');
			};

			// Open circuit
			for (let i = 0; i < 2; i++) {
				try {
					await resilientOps.execute(alwaysFailingOperation, 'test-operation');
				} catch (error) {
					// Expected to fail
				}
			}

			expect(resilientOps.getCircuitBreakerState().state).toBe('OPEN');

			// Reset circuit breaker manually
			resilientOps.resetCircuitBreaker();

			expect(resilientOps.getCircuitBreakerState().state).toBe('CLOSED');

			// Should work now
			const result = await resilientOps.execute(async () => 'success', 'test-operation');

			expect(result).toBe('success');
		});

		it('should provide state information', () => {
			const state = resilientOps.getCircuitBreakerState();
			const config = resilientOps.getRetryConfig();

			expect(state).toHaveProperty('state');
			expect(state).toHaveProperty('failureCount');
			expect(state).toHaveProperty('totalAttempts');

			expect(config).toHaveProperty('maxAttempts');
			expect(config).toHaveProperty('baseDelayMs');
			expect(config.maxAttempts).toBe(2);
		});
	});

	describe('Real-world scenarios', () => {
		it('should handle STT-like initialization failures with recovery', async () => {
			let initAttempts = 0;
			const flakyInitialization = async () => {
				initAttempts++;

				// Simulate model download failures on first 2 attempts
				if (initAttempts <= 2) {
					throw new Error('Failed to download model: network timeout');
				}

				return 'Model initialized successfully';
			};

			const resilientOps = new ResilientOperationManager(
				{ failureThreshold: 5, resetTimeoutMs: 1000 },
				{ maxAttempts: 4, baseDelayMs: 50 }
			);

			const result = await resilientOps.execute(
				flakyInitialization,
				'Model-Initialization',
				(error) =>
					error instanceof Error &&
					(error.message.includes('network') || error.message.includes('download'))
			);

			expect(result).toBe('Model initialized successfully');
			expect(initAttempts).toBe(3);
		});

		it('should handle transcription failures with appropriate retry logic', async () => {
			let transcriptionAttempts = 0;
			const flakyTranscription = async () => {
				transcriptionAttempts++;

				// Simulate different types of failures
				if (transcriptionAttempts === 1) {
					throw new Error('Out of memory');
				}

				if (transcriptionAttempts === 2) {
					throw new Error('Resource temporarily unavailable');
				}

				return { text: 'Hello world', confidence: 0.95 };
			};

			const resilientOps = new ResilientOperationManager(
				{ failureThreshold: 3, resetTimeoutMs: 1000 },
				{ maxAttempts: 3, baseDelayMs: 25 }
			);

			const result = await resilientOps.execute(
				flakyTranscription,
				'Audio-Transcription',
				(error) => {
					if (error instanceof Error) {
						const message = error.message.toLowerCase();
						return (
							message.includes('memory') ||
							message.includes('resource') ||
							message.includes('unavailable')
						);
					}
					return false;
				}
			);

			expect(result).toEqual({ text: 'Hello world', confidence: 0.95 });
			expect(transcriptionAttempts).toBe(3);
		});
	});
});
