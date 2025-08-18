import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for the app to initialize
		await page.waitForTimeout(2000);
	});

	test('should send a message and receive a response', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send a simple message
		await chatInput.fill('Hi there!');
		await sendButton.click();

		// Check that user message appears in chat
		await expect(chatContainer.locator('span.bg-blue-500').last()).toContainText('Hi there!');

		// Wait for loading state
		const loadingMessage = chatContainer.locator('span:has-text("EMO is pondering...")');
		await expect(loadingMessage).toBeVisible();

		// Wait for AI response (with longer timeout for API call)
		await expect(chatContainer.locator('span.bg-gray-600').last()).toBeVisible({ timeout: 15000 });

		// Verify loading state disappears
		await expect(loadingMessage).not.toBeVisible();

		// Check that response is not empty
		const lastResponse = chatContainer.locator('span.bg-gray-600').last();
		const responseText = await lastResponse.textContent();
		expect(responseText?.length).toBeGreaterThan(0);
	});

	test('should handle Enter key to send messages', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Type message and press Enter
		await chatInput.fill('Test message via Enter key');
		await chatInput.press('Enter');

		// Verify message was sent
		await expect(chatContainer.locator('span.bg-blue-500').last()).toContainText(
			'Test message via Enter key'
		);
	});

	test('should disable input during response loading', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		// Send a message
		await chatInput.fill('Testing loading state');
		await sendButton.click();

		// During loading, input should be disabled
		await expect(chatInput).toBeDisabled();
		await expect(sendButton).toBeDisabled();

		// Wait for response and check inputs are enabled again
		await page.waitForTimeout(10000); // Wait for potential response
		await expect(chatInput).toBeEnabled({ timeout: 20000 });
		await expect(sendButton).toBeEnabled();
	});

	test('should handle empty messages gracefully', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Try to send empty message
		await sendButton.click();

		// Should not add empty message to chat
		const messageCount = await chatContainer.locator('span').count();

		// Try with whitespace only
		await chatInput.fill('   ');
		await sendButton.click();

		// Message count should remain the same
		const newMessageCount = await chatContainer.locator('span').count();
		expect(newMessageCount).toBe(messageCount);
	});

	test('should maintain chat history', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send first message
		await chatInput.fill('First message');
		await sendButton.click();

		// Wait for response
		await page.waitForTimeout(5000);

		// Send second message
		await chatInput.fill('Second message');
		await sendButton.click();

		// Both messages should be visible in history
		await expect(chatContainer.locator('span:has-text("First message")')).toBeVisible();
		await expect(chatContainer.locator('span:has-text("Second message")')).toBeVisible();

		// Should have at least 2 user messages
		const userMessages = chatContainer.locator('span.bg-blue-500');
		await expect(userMessages).toHaveCount(2, { timeout: 10000 });
	});

	test('should scroll chat container when messages overflow', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Send multiple messages to test scrolling
		for (let i = 1; i <= 5; i++) {
			await chatInput.fill(`Message ${i} - testing scroll behavior`);
			await sendButton.click();
			await page.waitForTimeout(1000); // Brief pause between messages
		}

		// Wait for responses and check that chat scrolled to bottom
		await page.waitForTimeout(3000);

		// Check that the chat container has overflow-y-auto class
		await expect(chatContainer).toHaveClass(/overflow-y-auto/);

		// The last message should be visible (auto-scroll to bottom)
		const lastMessage = chatContainer.locator('span.bg-blue-500').last();
		await expect(lastMessage).toBeVisible();
	});
});
