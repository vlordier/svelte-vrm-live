import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for app to fully load
		await page.waitForTimeout(5000);
	});

	test('should match homepage visual appearance', async ({ page }) => {
		// Wait for 3D scene to render
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Wait a bit more for VRM model to potentially load
		await page.waitForTimeout(5000);

		// Take full page screenshot
		await expect(page).toHaveScreenshot('homepage.png', {
			fullPage: true,
			threshold: 0.3, // Allow for some variance in 3D rendering
			animations: 'disabled'
		});
	});

	test('should match chat interface appearance', async ({ page }) => {
		const chatContainer = page.locator('div.fixed.-right-14');
		await expect(chatContainer).toBeVisible();

		// Focus on chat area
		await expect(chatContainer).toHaveScreenshot('chat-interface.png', {
			threshold: 0.2
		});
	});

	test('should match chat with messages appearance', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.fixed.-right-14');

		// Add a couple of messages to chat
		await chatInput.fill('Test message for visual test');
		await sendButton.click();

		// Wait briefly for message to appear
		await page.waitForTimeout(2000);

		// Add another message
		await chatInput.fill('Second test message');
		await sendButton.click();

		await page.waitForTimeout(1000);

		// Screenshot chat with messages
		await expect(chatContainer).toHaveScreenshot('chat-with-messages.png', {
			threshold: 0.2
		});
	});

	test('should match loading state appearance', async ({ page }) => {
		// Mock slow API response to capture loading state
		await page.route('/api/generate', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					answer: 'Test response',
					emotion: 'neutral'
				})
			});
		});

		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Trigger loading state');
		await sendButton.click();

		// Wait for loading state to appear
		const loadingMessage = page.locator('span:has-text("EMO is pondering...")');
		await expect(loadingMessage).toBeVisible();

		// Screenshot during loading
		const chatContainer = page.locator('div.fixed.-right-14');
		await expect(chatContainer).toHaveScreenshot('chat-loading-state.png', {
			threshold: 0.1
		});
	});

	test('should handle different viewport sizes', async ({ page }) => {
		// Test desktop view
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.waitForTimeout(1000);

		await expect(page).toHaveScreenshot('desktop-view.png', {
			fullPage: true,
			threshold: 0.3
		});

		// Test tablet view
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.waitForTimeout(1000);

		await expect(page).toHaveScreenshot('tablet-view.png', {
			fullPage: true,
			threshold: 0.3
		});

		// Test mobile view
		await page.setViewportSize({ width: 375, height: 812 });
		await page.waitForTimeout(1000);

		await expect(page).toHaveScreenshot('mobile-view.png', {
			fullPage: true,
			threshold: 0.3
		});
	});

	test('should maintain 3D scene visual consistency', async ({ page }) => {
		// Wait for 3D scene to fully render
		await page.waitForTimeout(8000);

		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible();

		// Take screenshot of just the 3D scene area
		await expect(canvas).toHaveScreenshot('3d-scene.png', {
			threshold: 0.4, // Higher threshold for 3D rendering variance
			animations: 'disabled'
		});
	});

	test('should show error states correctly', async ({ page }) => {
		// Mock API error
		await page.route('/api/generate', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Server error' })
			});
		});

		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Trigger error state');
		await sendButton.click();

		// Wait for error message
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');
		await expect(chatContainer.locator('span:has-text("trouble thinking")')).toBeVisible({
			timeout: 10000
		});

		// Screenshot error state
		await expect(chatContainer).toHaveScreenshot('chat-error-state.png', {
			threshold: 0.1
		});
	});
});
