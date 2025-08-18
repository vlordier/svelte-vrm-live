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

		// Send a message to trigger API call
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Hello API test');
		await sendButton.click();

		// Wait a bit for API call
		await page.waitForTimeout(3000);

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

		// Should show error message in chat
		await expect(chatContainer.locator('span:has-text("trouble thinking")')).toBeVisible({
			timeout: 10000
		});
	});
});
