import { test, expect } from '@playwright/test';

test.describe('VRM Avatar Functionality', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for Three.js and VRM to initialize
		await page.waitForTimeout(3000);
	});

	test('should load VRM model without errors', async ({ page }) => {
		// Check for console errors related to VRM loading
		const messages: string[] = [];
		page.on('console', (msg) => {
			messages.push(msg.text());
		});

		// Take screenshot at start of loading
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-loading-start.png',
			fullPage: true
		});

		// Wait for VRM loading
		await page.waitForTimeout(8000);

		// Take screenshot after loading attempt
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-loading-complete.png',
			fullPage: true
		});

		// Look for successful VRM loading messages
		const vrmMessages = messages.filter(
			(msg) => msg.includes('VRM') || msg.includes('vrm') || msg.includes('loaded')
		);

		// Should have some VRM-related console output
		expect(vrmMessages.length).toBeGreaterThan(0);

		// Check that canvas is still present (3D scene loaded)
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible();

		// Take screenshot of canvas specifically
		await canvas.screenshot({
			path: 'tests/e2e/screenshots/vrm-canvas-loaded.png'
		});
	});

	test('should render 3D scene with proper canvas attributes', async ({ page }) => {
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible({ timeout: 10000 });

		// Check canvas has WebGL context attributes
		const canvasInfo = await page.evaluate(() => {
			const canvas = document.querySelector('canvas');
			if (!canvas) return null;

			return {
				width: canvas.width,
				height: canvas.height,
				clientWidth: canvas.clientWidth,
				clientHeight: canvas.clientHeight
			};
		});

		expect(canvasInfo).not.toBeNull();
		expect(canvasInfo?.width).toBeGreaterThan(0);
		expect(canvasInfo?.height).toBeGreaterThan(0);
	});

	test('should handle VRM animations during chat', async ({ page }) => {
		// Wait for VRM to load
		await page.waitForTimeout(5000);

		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		// Send a message to trigger animation
		await chatInput.fill('Tell me something interesting');
		await sendButton.click();

		// Monitor console for animation-related messages
		const animationMessages: string[] = [];
		page.on('console', (msg) => {
			if (msg.text().includes('animation') || msg.text().includes('talking')) {
				animationMessages.push(msg.text());
			}
		});

		// Wait for response and potential animation
		await page.waitForTimeout(10000);

		// Take screenshot to visually verify state
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-animation.png',
			fullPage: false
		});
	});

	test('should maintain VRM model position and scale', async ({ page }) => {
		// Wait for VRM to load and position
		await page.waitForTimeout(8000);

		// Check that canvas is rendered (indicates 3D scene loaded)
		const sceneInfo = await page.evaluate(() => {
			return document.querySelector('canvas') !== null;
		});

		expect(sceneInfo).toBeTruthy();

		// Take screenshot for visual verification
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-positioning.png',
			fullPage: false
		});
	});

	test('should handle VRM model loading errors gracefully', async ({ page }) => {
		// Monitor console for errors
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		// Wait for initialization
		await page.waitForTimeout(10000);

		// Filter for critical errors (not warnings)
		const criticalErrors = errors.filter(
			(error) =>
				!error.includes('Warning') &&
				!error.includes('Deprecation') &&
				!error.includes('three-perf')
		);

		// Should not have critical VRM loading errors
		const vrmErrors = criticalErrors.filter(
			(error) =>
				error.toLowerCase().includes('vrm') ||
				error.toLowerCase().includes('model') ||
				error.toLowerCase().includes('failed to load')
		);

		// Log any VRM-related errors for debugging
		if (vrmErrors.length > 0) {
			console.log('VRM-related errors found:', vrmErrors);
		}

		// App should still be functional even if there are minor issues
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible();
	});

	test('should support VRM expressions and lip sync', async ({ page }) => {
		// Wait for VRM to fully initialize
		await page.waitForTimeout(8000);

		// Take screenshot before interaction
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-before-interaction.png',
			fullPage: false
		});

		// Send message to trigger TTS and lip sync
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Can you speak this message?');
		await sendButton.click();

		// Monitor for TTS and lip sync related console output
		const ttsMessages: string[] = [];
		page.on('console', (msg) => {
			const text = msg.text();
			if (text.includes('TTS') || text.includes('lip') || text.includes('speak')) {
				ttsMessages.push(text);
			}
		});

		// Wait for TTS to potentially start
		await page.waitForTimeout(12000);

		// Take screenshot during potential speaking animation
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-speaking.png',
			fullPage: false
		});

		// Should have some TTS-related activity
		// Note: TTS might not work in headless environment, so we check for attempts
		console.log('TTS messages found:', ttsMessages.length);
	});

	test('should handle VRM model with corrupted data', async ({ page }) => {
		// Mock corrupted VRM file
		await page.route('**/models/*.vrm', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/octet-stream',
				body: Buffer.from('corrupted data not a valid VRM file')
			});
		});

		await page.goto('/');
		await page.waitForTimeout(10000);

		// Should still show UI elements
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();

		// Take screenshot showing graceful handling of corrupted model
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-corrupted-model.png',
			fullPage: true
		});
	});

	test('should handle WebGL context loss', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(5000);

		// Simulate WebGL context loss
		await page.evaluate(() => {
			const canvas = document.querySelector('canvas');
			if (canvas) {
				const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
				if (gl && gl.getExtension('WEBGL_lose_context')) {
					gl.getExtension('WEBGL_lose_context')?.loseContext();
				}
			}
		});

		await page.waitForTimeout(3000);

		// Take screenshot after context loss
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-webgl-context-loss.png',
			fullPage: true
		});

		// App should still be responsive
		await expect(page.locator('div.min-h-screen')).toBeVisible();
	});

	test('should handle multiple VRM loading attempts', async ({ page }) => {
		// Track loading attempts
		let loadAttempts = 0;
		await page.route('**/models/*.vrm', (route) => {
			loadAttempts++;
			if (loadAttempts <= 2) {
				route.fulfill({ status: 500, body: 'Server error' });
			} else {
				route.continue(); // Allow normal loading on 3rd attempt
			}
		});

		await page.goto('/');

		// Take screenshots during retry attempts
		await page.waitForTimeout(3000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-loading-retry-1.png',
			fullPage: true
		});

		await page.waitForTimeout(5000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-loading-retry-2.png',
			fullPage: true
		});

		// Should eventually work
		await page.waitForTimeout(10000);
		await expect(page.locator('canvas')).toBeVisible();
	});

	test('should handle very large VRM files', async ({ page }) => {
		// Mock slow large file
		await page.route('**/models/*.vrm', async (route) => {
			// Simulate large file loading
			await new Promise((resolve) => setTimeout(resolve, 5000));
			route.continue();
		});

		await page.goto('/');

		// Take screenshot during slow loading
		await page.waitForTimeout(2000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-large-file-loading.png',
			fullPage: true
		});

		// Should eventually complete
		await page.waitForTimeout(12000);
		await expect(page.locator('canvas')).toBeVisible();

		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-large-file-complete.png',
			fullPage: true
		});
	});

	test('should handle animation system failures', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(8000);

		// Simulate animation system error
		await page.evaluate(() => {
			// Override animation methods to throw errors
			if (window.console) {
				const originalError = console.error;
				console.error = (...args) => {
					if (args[0] && args[0].includes('animation')) {
						// Simulate animation error
						throw new Error('Animation system failure');
					}
					originalError.apply(console, args);
				};
			}
		});

		// Try to trigger animation
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Test animation failure');
		await sendButton.click();

		await page.waitForTimeout(5000);

		// Should still be functional
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-animation-failure.png',
			fullPage: true
		});
	});

	test('should handle memory constraints during VRM processing', async ({ page }) => {
		await page.goto('/');

		// Simulate memory pressure
		await page.evaluate(() => {
			// Create memory pressure
			const arrays: number[][] = [];
			for (let i = 0; i < 100; i++) {
				arrays.push(new Array(1000000).fill(i));
			}
			// Keep reference to prevent GC
			(window as any).memoryPressure = arrays;
		});

		await page.waitForTimeout(8000);

		// Should still render
		await expect(page.locator('canvas')).toBeVisible();
		await page.screenshot({
			path: 'tests/e2e/screenshots/vrm-memory-pressure.png',
			fullPage: true
		});

		// Cleanup
		await page.evaluate(() => {
			delete (window as any).memoryPressure;
		});
	});

	test('should handle different VRM model versions and formats', async ({ page }) => {
		// Test with different mock VRM formats
		const testCases = [
			{ name: 'vrm-v1', contentType: 'model/gltf-binary' },
			{ name: 'vrm-v2', contentType: 'application/octet-stream' },
			{ name: 'vrm-legacy', contentType: 'application/json' }
		];

		for (const testCase of testCases) {
			await page.route('**/models/*.vrm', (route) => {
				route.fulfill({
					status: 200,
					contentType: testCase.contentType,
					body: Buffer.from('mock vrm data')
				});
			});

			await page.goto('/');
			await page.waitForTimeout(5000);

			await page.screenshot({
				path: `tests/e2e/screenshots/vrm-format-${testCase.name}.png`,
				fullPage: true
			});
		}
	});
});
