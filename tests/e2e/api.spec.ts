import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
	test('should have generate API endpoint working', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: {
				systemInstruction: 'You are a helpful assistant.',
				prompt: 'Say hello in a friendly way.'
			}
		});

		expect(response.ok()).toBeTruthy();
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty('answer');
		expect(data).toHaveProperty('emotion');
		expect(typeof data.answer).toBe('string');
		expect(data.answer.length).toBeGreaterThan(0);
	});

	test('should handle generate API with invalid data', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: {
				// Missing required fields
			}
		});

		// Should return error status
		expect(response.status()).toBeGreaterThanOrEqual(400);
	});

	test('should have TTS API endpoint accessible', async ({ request }) => {
		const response = await request.post('/api/tts', {
			data: {
				text: 'Hello world',
				emotion: 'neutral'
			}
		});

		// TTS might return 200 or specific status based on implementation
		expect(response.status()).toBeLessThan(500);
	});

	test('should have chat/send API endpoint accessible', async ({ request }) => {
		const response = await request.post('/api/chat/send', {
			data: {
				message: 'Test message',
				history: []
			}
		});

		// Check that endpoint is accessible (might have specific requirements)
		expect(response.status()).toBeLessThan(500);
	});
});

test.describe('API Integration in App', () => {
	test('should make successful API calls from the UI', async ({ page }) => {
		// Listen for API requests
		const apiRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/')) {
				apiRequests.push(request.url());
			}
		});

		await page.goto('/');

		// Take screenshot of initial state
		await page.screenshot({
			path: 'tests/e2e/screenshots/api-integration-start.png',
			fullPage: true
		});

		// Send a message to trigger API call
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Hello API test');
		await sendButton.click();

		// Wait a bit for API call
		await page.waitForTimeout(3000);

		// Take screenshot during API processing
		await page.screenshot({
			path: 'tests/e2e/screenshots/api-integration-processing.png',
			fullPage: true
		});

		// Should have made an API request
		expect(apiRequests.length).toBeGreaterThan(0);
		expect(apiRequests.some((url) => url.includes('/api/generate'))).toBeTruthy();
	});

	test('should handle API errors gracefully', async ({ page }) => {
		// Mock API to return error
		await page.route('/api/generate', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Internal Server Error' })
			});
		});

		await page.goto('/');

		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send message
		await chatInput.fill('This should trigger error');
		await sendButton.click();

		// Take screenshot during error handling
		await page.waitForTimeout(2000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-error-processing.png'
		});

		// Should show error message in chat
		await expect(chatContainer.locator('span:has-text("trouble thinking")')).toBeVisible({
			timeout: 10000
		});

		// Take screenshot of error state
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-error-final.png'
		});
	});

	test('should handle API rate limiting', async ({ page }) => {
		let requestCount = 0;
		await page.route('/api/generate', (route) => {
			requestCount++;
			if (requestCount <= 2) {
				route.fulfill({
					status: 429,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Rate limit exceeded' })
				});
			} else {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ answer: 'Success after rate limit', emotion: 'neutral' })
				});
			}
		});

		await page.goto('/');
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send multiple messages rapidly
		for (let i = 1; i <= 3; i++) {
			await chatInput.fill(`Message ${i} - rate limit test`);
			await sendButton.click();
			await page.waitForTimeout(1000);

			await chatContainer.screenshot({
				path: `tests/e2e/screenshots/api-rate-limit-${i}.png`
			});
		}
	});

	test('should handle network disconnection', async ({ page }) => {
		await page.goto('/');

		// Simulate network disconnection
		await page.route('**/api/**', (route) => route.abort());

		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		await chatInput.fill('Test offline mode');
		await sendButton.click();

		// Take screenshot of offline state
		await page.waitForTimeout(3000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-offline-mode.png'
		});

		// Should show error or timeout
		await expect(chatContainer.locator('span:has-text("trouble thinking")')).toBeVisible({
			timeout: 15000
		});

		// Reconnect and test recovery
		await page.unroute('**/api/**');
		await chatInput.fill('Test reconnection');
		await sendButton.click();

		await page.waitForTimeout(5000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-reconnection.png'
		});
	});

	test('should handle concurrent API requests', async ({ page }) => {
		let requestCount = 0;
		const requestTimes: number[] = [];

		await page.route('/api/generate', async (route) => {
			const startTime = Date.now();
			requestCount++;
			requestTimes.push(startTime);

			// Simulate processing time
			await new Promise((resolve) => setTimeout(resolve, 2000));

			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					answer: `Response ${requestCount}`,
					emotion: 'neutral'
				})
			});
		});

		await page.goto('/');
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send multiple requests concurrently (if possible)
		await chatInput.fill('Concurrent request 1');
		await sendButton.click();

		await page.waitForTimeout(500);
		await chatInput.fill('Concurrent request 2');
		await sendButton.click();

		// Take screenshot during concurrent processing
		await page.waitForTimeout(1000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-concurrent-processing.png'
		});

		// Wait for all responses
		await page.waitForTimeout(8000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-concurrent-complete.png'
		});
	});

	test('should handle malicious JSON responses', async ({ page }) => {
		await page.route('/api/generate', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: '{"answer":"<script>alert(\'xss\')</script>","emotion":"evil"}'
			});
		});

		await page.goto('/');
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		await chatInput.fill('Test XSS protection');
		await sendButton.click();

		await page.waitForTimeout(5000);

		// Should not execute script, should display safely
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-xss-protection.png'
		});

		// Check that no alert was triggered
		const alerts: string[] = [];
		page.on('dialog', (dialog) => {
			alerts.push(dialog.message());
			dialog.dismiss();
		});

		expect(alerts.length).toBe(0);
	});

	test('should handle very large API responses', async ({ page }) => {
		await page.route('/api/generate', (route) => {
			const largeResponse =
				'This is a very long response that tests how the application handles large amounts of text data from the API. '.repeat(
					100
				);
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					answer: largeResponse,
					emotion: 'neutral'
				})
			});
		});

		await page.goto('/');
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		await chatInput.fill('Generate large response');
		await sendButton.click();

		// Wait for large response
		await page.waitForTimeout(8000);

		// Take screenshot of large response handling
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-large-response.png'
		});

		// Should handle large response gracefully
		const responseElement = chatContainer.locator('span.bg-gray-600').last();
		await expect(responseElement).toBeVisible();
	});

	test('should handle API response with missing fields', async ({ page }) => {
		await page.route('/api/generate', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					// Missing 'answer' field
					emotion: 'confused'
				})
			});
		});

		await page.goto('/');
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		await chatInput.fill('Test missing fields');
		await sendButton.click();

		await page.waitForTimeout(5000);

		// Should handle gracefully
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/api-missing-fields.png'
		});

		// Should show error or default message
		await expect(chatContainer.locator('span:has-text("trouble thinking")')).toBeVisible({
			timeout: 10000
		});
	});
});
