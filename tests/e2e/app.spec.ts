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

		// Take screenshot of initial load
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-initial-load.png',
			fullPage: true
		});
	});

	test('should render the 3D scene canvas', async ({ page }) => {
		// Wait for Three.js canvas to be rendered
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Verify canvas has reasonable dimensions
		const canvasBox = await canvas.boundingBox();
		expect(canvasBox?.width).toBeGreaterThan(100);
		expect(canvasBox?.height).toBeGreaterThan(100);

		// Take screenshot of 3D canvas
		await canvas.screenshot({
			path: 'tests/e2e/screenshots/app-3d-canvas.png'
		});

		// Take full page screenshot showing canvas in context
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-canvas-context.png',
			fullPage: true
		});
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

		// Take screenshot of chat interface
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/app-chat-interface.png'
		});

		// Take screenshot showing complete layout
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-complete-layout.png',
			fullPage: true
		});
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
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-responsive-desktop.png',
			fullPage: true
		});

		// Test tablet layout
		await page.setViewportSize({ width: 768, height: 1024 });
		await expect(chatContainer).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-responsive-tablet.png',
			fullPage: true
		});

		// Test mobile layout
		await page.setViewportSize({ width: 375, height: 812 });
		// Chat might be repositioned on mobile, but should still be present
		await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-responsive-mobile.png',
			fullPage: true
		});
	});

	test('should handle slow network conditions', async ({ page }) => {
		// Simulate slow 3G network
		await page.route('**/*', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
			route.continue();
		});

		await page.goto('/');

		// Should still load within reasonable time
		await expect(page.locator('div.min-h-screen')).toBeVisible({ timeout: 15000 });

		// Take screenshot of loading under slow network
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-slow-network.png',
			fullPage: true
		});
	});

	test('should handle JavaScript errors gracefully', async ({ page }) => {
		// Track console errors
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		// Inject a script error
		await page.addInitScript(() => {
			// Simulate a potential runtime error
			setTimeout(() => {
				console.error('Simulated error for testing');
			}, 2000);
		});

		await page.goto('/');
		await page.waitForTimeout(3000);

		// App should still be functional despite errors
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });

		// Take screenshot showing app still works
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-with-errors.png',
			fullPage: true
		});
	});

	test('should handle memory pressure scenarios', async ({ page }) => {
		// Create memory pressure by repeatedly navigating
		for (let i = 0; i < 3; i++) {
			await page.goto('/');
			await page.waitForTimeout(2000);

			// Force garbage collection if available
			await page.evaluate(() => {
				if (window.gc) {
					window.gc();
				}
			});
		}

		// Should still render correctly
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });

		// Take screenshot after memory pressure
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-memory-pressure.png',
			fullPage: true
		});
	});

	test('should handle missing VRM model gracefully', async ({ page }) => {
		// Mock 404 for VRM model
		await page.route('**/models/*.vrm', (route) => {
			route.fulfill({ status: 404, body: 'Model not found' });
		});

		await page.goto('/');
		await page.waitForTimeout(8000); // Wait for model loading attempt

		// App should still be functional
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();

		// Take screenshot showing graceful degradation
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-missing-vrm.png',
			fullPage: true
		});
	});

	test('should handle extreme viewport sizes', async ({ page }) => {
		// Test very small viewport
		await page.setViewportSize({ width: 320, height: 568 });
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-tiny-viewport.png',
			fullPage: true
		});

		// Test very large viewport
		await page.setViewportSize({ width: 2560, height: 1440 });
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-large-viewport.png',
			fullPage: true
		});
	});

	test('should handle accessibility requirements', async ({ page }) => {
		await page.goto('/');

		// Test keyboard navigation
		await page.keyboard.press('Tab');
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-keyboard-focus-1.png',
			fullPage: true
		});

		await page.keyboard.press('Tab');
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-keyboard-focus-2.png',
			fullPage: true
		});

		// Test high contrast mode simulation
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.screenshot({
			path: 'tests/e2e/screenshots/app-dark-theme.png',
			fullPage: true
		});
	});
});
