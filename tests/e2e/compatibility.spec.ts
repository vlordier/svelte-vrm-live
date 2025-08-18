import { test, expect, devices } from '@playwright/test';

test.describe('Browser Compatibility Tests', () => {
	const testBrowsers = [
		{ name: 'chromium', device: devices['Desktop Chrome'] },
		{ name: 'firefox', device: devices['Desktop Firefox'] },
		{ name: 'webkit', device: devices['Desktop Safari'] }
	];

	testBrowsers.forEach(({ name, device }) => {
		test.describe(`${name} compatibility`, () => {
			test.use({ ...device });

			test(`should load correctly in ${name}`, async ({ page, browserName }) => {
				await page.goto('/');
				await page.waitForTimeout(3000);

				// Take screenshot for each browser
				await page.screenshot({
					path: `tests/e2e/screenshots/browser-${browserName}-load.png`,
					fullPage: true
				});

				// Basic functionality should work
				await expect(page.locator('div.min-h-screen')).toBeVisible();
				await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
				await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();
			});

			test(`should handle WebGL in ${name}`, async ({ page, browserName }) => {
				await page.goto('/');

				// Check WebGL support
				const webglSupport = await page.evaluate(() => {
					const canvas = document.createElement('canvas');
					const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
					return gl !== null;
				});

				console.log(`${browserName} WebGL support:`, webglSupport);

				if (webglSupport) {
					// Should render 3D canvas
					await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
				}

				// Take screenshot regardless of WebGL support
				await page.screenshot({
					path: `tests/e2e/screenshots/browser-${browserName}-webgl.png`,
					fullPage: true
				});
			});

			test(`should handle JavaScript features in ${name}`, async ({ page, browserName }) => {
				await page.goto('/');

				// Test modern JavaScript features
				const jsFeatures = await page.evaluate(() => {
					return {
						asyncAwait: typeof async function () {} === 'function',
						promises: typeof Promise !== 'undefined',
						fetch: typeof fetch !== 'undefined',
						localStorage: typeof localStorage !== 'undefined',
						crypto: typeof crypto !== 'undefined',
						audioContext:
							typeof AudioContext !== 'undefined' ||
							typeof (window as any).webkitAudioContext !== 'undefined'
					};
				});

				console.log(`${browserName} JavaScript features:`, jsFeatures);

				// Core features should be supported
				expect(jsFeatures.promises).toBe(true);
				expect(jsFeatures.fetch).toBe(true);

				// Take screenshot
				await page.screenshot({
					path: `tests/e2e/screenshots/browser-${browserName}-js-features.png`,
					fullPage: true
				});
			});

			test(`should handle CSS features in ${name}`, async ({ page, browserName }) => {
				await page.goto('/');
				await page.waitForTimeout(2000);

				// Check CSS Grid support
				const cssSupport = await page.evaluate(() => {
					const testElement = document.createElement('div');
					testElement.style.display = 'grid';
					document.body.appendChild(testElement);
					const supportsGrid = window.getComputedStyle(testElement).display === 'grid';
					document.body.removeChild(testElement);

					return {
						grid: supportsGrid,
						flexbox: CSS.supports('display', 'flex'),
						customProperties: CSS.supports('color', 'var(--test)'),
						transforms: CSS.supports('transform', 'translateX(10px)')
					};
				});

				console.log(`${browserName} CSS features:`, cssSupport);

				// Take screenshot showing CSS rendering
				await page.screenshot({
					path: `tests/e2e/screenshots/browser-${browserName}-css.png`,
					fullPage: true
				});

				// Layout should work even with limited CSS support
				await expect(page.locator('div.min-h-screen')).toBeVisible();
			});
		});
	});

	test.describe('Mobile compatibility', () => {
		const mobileDevices = [
			{ name: 'iphone', device: devices['iPhone 12'] },
			{ name: 'android', device: devices['Pixel 5'] },
			{ name: 'tablet', device: devices['iPad Pro'] }
		];

		mobileDevices.forEach(({ name, device }) => {
			test(`should work on ${name}`, async ({ browser }) => {
				const context = await browser.newContext({
					...device
				});
				const page = await context.newPage();

				await page.goto('/');
				await page.waitForTimeout(3000);

				// Take screenshot for mobile device
				await page.screenshot({
					path: `tests/e2e/screenshots/mobile-${name}.png`,
					fullPage: true
				});

				// Basic elements should be visible and functional
				await expect(page.locator('div.min-h-screen')).toBeVisible();
				await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();

				// Test touch interaction
				const chatInput = page.locator('textarea[placeholder*="Type your message"]');
				await chatInput.tap();
				await chatInput.fill('Mobile test message');

				await page.screenshot({
					path: `tests/e2e/screenshots/mobile-${name}-interaction.png`,
					fullPage: true
				});

				await context.close();
			});
		});
	});

	test.describe('Legacy browser simulation', () => {
		test('should handle older JavaScript engines', async ({ page }) => {
			// Simulate older browser by polyfilling/removing modern features
			await page.addInitScript(() => {
				// Remove some modern features to simulate older browsers
				delete (window as any).fetch;
				delete (window as any).Promise;
			});

			await page.goto('/');
			await page.waitForTimeout(3000);

			// Should still load basic functionality
			await expect(page.locator('div.min-h-screen')).toBeVisible();

			await page.screenshot({
				path: 'tests/e2e/screenshots/legacy-browser-simulation.png',
				fullPage: true
			});
		});

		test('should handle limited WebGL support', async ({ page }) => {
			// Mock WebGL context creation failure
			await page.addInitScript(() => {
				const originalGetContext = HTMLCanvasElement.prototype.getContext;
				HTMLCanvasElement.prototype.getContext = function (
					contextType: string,
					...args: any[]
				): any {
					if (contextType === 'webgl' || contextType === 'experimental-webgl') {
						return null; // Simulate WebGL not available
					}
					return originalGetContext.call(this, contextType, ...args);
				};
			});

			await page.goto('/');
			await page.waitForTimeout(5000);

			// Should handle gracefully without WebGL
			await expect(page.locator('div.min-h-screen')).toBeVisible();
			await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();

			await page.screenshot({
				path: 'tests/e2e/screenshots/no-webgl-fallback.png',
				fullPage: true
			});
		});

		test('should work with JavaScript disabled features', async ({ page }) => {
			// Disable some modern JavaScript features
			await page.addInitScript(() => {
				delete (window as any).AudioContext;
				delete (window as any).webkitAudioContext;
				delete (window as any).crypto;
			});

			await page.goto('/');
			await page.waitForTimeout(3000);

			// Core functionality should still work
			await expect(page.locator('div.min-h-screen')).toBeVisible();

			const chatInput = page.locator('textarea[placeholder*="Type your message"]');
			await chatInput.fill('Testing without modern features');

			await page.screenshot({
				path: 'tests/e2e/screenshots/limited-js-features.png',
				fullPage: true
			});
		});
	});

	test.describe('Network conditions', () => {
		test('should work on slow 3G connection', async ({ page }) => {
			// Simulate slow 3G
			await page.route('**/*', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
				route.continue();
			});

			await page.goto('/');

			// Take screenshot during slow loading
			await page.waitForTimeout(2000);
			await page.screenshot({
				path: 'tests/e2e/screenshots/slow-3g-loading.png',
				fullPage: true
			});

			// Should eventually load
			await expect(page.locator('div.min-h-screen')).toBeVisible({ timeout: 15000 });

			await page.screenshot({
				path: 'tests/e2e/screenshots/slow-3g-loaded.png',
				fullPage: true
			});
		});

		test('should work with intermittent connectivity', async ({ page }) => {
			let requestCount = 0;

			await page.route('**/*', async (route) => {
				requestCount++;
				// Fail every 3rd request to simulate intermittent connectivity
				if (requestCount % 3 === 0) {
					route.abort('internetdisconnected');
				} else {
					route.continue();
				}
			});

			await page.goto('/');
			await page.waitForTimeout(8000);

			// Should handle intermittent failures gracefully
			await expect(page.locator('div.min-h-screen')).toBeVisible();

			await page.screenshot({
				path: 'tests/e2e/screenshots/intermittent-connectivity.png',
				fullPage: true
			});
		});
	});

	test.describe('Browser-specific quirks', () => {
		test('should handle Safari-specific behaviors', async ({ page, browserName }) => {
			// Only run on WebKit/Safari
			test.skip(browserName !== 'webkit');

			await page.goto('/');
			await page.waitForTimeout(3000);

			// Test Safari-specific issues
			const safariQuirks = await page.evaluate(() => {
				return {
					webkitAudioContext: typeof (window as any).webkitAudioContext !== 'undefined',
					touchForceChange: 'ontouchforcechange' in window,
					standalone: (navigator as any).standalone !== undefined
				};
			});

			console.log('Safari-specific features:', safariQuirks);

			await page.screenshot({
				path: 'tests/e2e/screenshots/safari-specific.png',
				fullPage: true
			});
		});

		test('should handle Firefox-specific behaviors', async ({ page, browserName }) => {
			// Only run on Firefox
			test.skip(browserName !== 'firefox');

			await page.goto('/');
			await page.waitForTimeout(3000);

			// Test Firefox-specific features
			const firefoxFeatures = await page.evaluate(() => {
				return {
					mozConnection: 'mozConnection' in navigator,
					mozBattery: 'mozBattery' in navigator,
					mozGetUserMedia: 'mozGetUserMedia' in navigator
				};
			});

			console.log('Firefox-specific features:', firefoxFeatures);

			await page.screenshot({
				path: 'tests/e2e/screenshots/firefox-specific.png',
				fullPage: true
			});
		});

		test('should handle Chrome-specific behaviors', async ({ page, browserName }) => {
			// Only run on Chromium/Chrome
			test.skip(browserName !== 'chromium');

			await page.goto('/');
			await page.waitForTimeout(3000);

			// Test Chrome-specific features
			const chromeFeatures = await page.evaluate(() => {
				return {
					chrome: typeof (window as any).chrome !== 'undefined',
					webkitSpeechRecognition: typeof (window as any).webkitSpeechRecognition !== 'undefined',
					webkitNotifications: typeof (window as any).webkitNotifications !== 'undefined'
				};
			});

			console.log('Chrome-specific features:', chromeFeatures);

			await page.screenshot({
				path: 'tests/e2e/screenshots/chrome-specific.png',
				fullPage: true
			});
		});
	});

	test.describe('Feature detection', () => {
		test('should gracefully handle missing features', async ({ page }) => {
			await page.goto('/');

			// Check which features are available
			const availableFeatures = await page.evaluate(() => {
				return {
					webgl: (() => {
						const canvas = document.createElement('canvas');
						return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
					})(),
					audioContext:
						typeof AudioContext !== 'undefined' ||
						typeof (window as any).webkitAudioContext !== 'undefined',
					fetch: typeof fetch !== 'undefined',
					localStorage: typeof localStorage !== 'undefined',
					crypto: typeof crypto !== 'undefined',
					promises: typeof Promise !== 'undefined',
					modules: 'noModule' in document.createElement('script'),
					intersectionObserver: 'IntersectionObserver' in window,
					resizeObserver: 'ResizeObserver' in window
				};
			});

			console.log('Available browser features:', availableFeatures);

			// App should work regardless of feature availability
			await expect(page.locator('div.min-h-screen')).toBeVisible();

			await page.screenshot({
				path: 'tests/e2e/screenshots/feature-detection.png',
				fullPage: true
			});

			// Test core functionality works with available features
			const chatInput = page.locator('textarea[placeholder*="Type your message"]');
			await chatInput.fill('Feature detection test');

			await page.screenshot({
				path: 'tests/e2e/screenshots/feature-detection-interaction.png',
				fullPage: true
			});
		});
	});
});
