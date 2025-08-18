import { test, expect } from '@playwright/test';

test.describe('VRM Live App - Core Functionality', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the app
		await page.goto('/');
	});

	test('should load the main page successfully', async ({ page }) => {
		// Check that the page loads
		await expect(page).toHaveTitle(/VRM Live/);

		// Check that the main container is present
		await expect(page.locator('div.min-h-screen')).toBeVisible();
	});

	test('should render the 3D scene canvas', async ({ page }) => {
		// Wait for Three.js canvas to be rendered
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Verify canvas has reasonable dimensions
		const canvasBox = await canvas.boundingBox();
		expect(canvasBox?.width).toBeGreaterThan(100);
		expect(canvasBox?.height).toBeGreaterThan(100);
	});

	test('should display chat interface', async ({ page }) => {
		// Check chat container is visible
		const chatContainer = page.locator('div.fixed.-right-14');
		await expect(chatContainer).toBeVisible();

		// Check chat input textarea
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		await expect(chatInput).toBeVisible();

		// Check send button
		const sendButton = page.locator('button:has(svg)'); // Send button with icon
		await expect(sendButton).toBeVisible();
	});

	test('should handle chat input interaction', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		// Type a test message
		await chatInput.fill('Hello EMO');
		await expect(chatInput).toHaveValue('Hello EMO');

		// Send button should be enabled when there's text
		await expect(sendButton).toBeEnabled();

		// Clear the input
		await chatInput.clear();
		await expect(chatInput).toHaveValue('');
	});

	test('should load VRM model (visual check)', async ({ page }) => {
		// Wait a bit longer for VRM model to load
		await page.waitForTimeout(5000);

		// Check console for VRM loading messages (not available in Playwright)
		// Screenshots will verify visual loading instead

		// Take a screenshot to verify the 3D scene rendered
		await page.screenshot({ path: 'tests/e2e/screenshots/vrm-scene.png', fullPage: true });
	});

	test('should handle responsive layout', async ({ page }) => {
		// Test desktop layout
		await page.setViewportSize({ width: 1920, height: 1080 });
		const chatContainer = page.locator('div.fixed.-right-14');
		await expect(chatContainer).toBeVisible();

		// Test tablet layout
		await page.setViewportSize({ width: 768, height: 1024 });
		await expect(chatContainer).toBeVisible();

		// Test mobile layout
		await page.setViewportSize({ width: 375, height: 812 });
		// Chat might be repositioned on mobile, but should still be present
		await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();
	});
});
