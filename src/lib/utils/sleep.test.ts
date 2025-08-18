import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sleep } from './sleep';

describe('sleep', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should resolve after specified milliseconds', async () => {
		const promise = sleep(1000);

		// Fast-forward time
		vi.advanceTimersByTime(1000);

		await expect(promise).resolves.toBeUndefined();
	});

	it('should not resolve before specified time', () => {
		const promise = sleep(1000);
		let resolved = false;

		promise.then(() => {
			resolved = true;
		});

		// Advance time but not enough
		vi.advanceTimersByTime(500);

		expect(resolved).toBe(false);

		// Now advance the full time and check it resolves
		vi.advanceTimersByTime(500);
		return promise; // Return promise for proper async handling
	});

	it('should work with zero milliseconds', async () => {
		const promise = sleep(0);

		vi.advanceTimersByTime(0);

		await expect(promise).resolves.toBeUndefined();
	});
});
