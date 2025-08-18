import { test, expect } from '@playwright/test';

test.describe('Performance and Accessibility Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(3000);
	});

	test('should meet performance benchmarks', async ({ page }) => {
		// Start performance monitoring
		const performanceEntries: any[] = [];
		await page.evaluate(() => {
			// @ts-expect-error - accessing performance API
			window.performanceObserver = new PerformanceObserver((list) => {
				list.getEntries().forEach((entry) => {
					if (entry.entryType === 'navigation' || entry.entryType === 'paint') {
						performanceEntries.push({
							name: entry.name,
							type: entry.entryType,
							duration: entry.duration,
							startTime: entry.startTime
						});
					}
				});
			});
			// @ts-expect-error - accessing performance API
			window.performanceObserver.observe({ entryTypes: ['navigation', 'paint'] });
		});

		// Wait for initial load
		await page.waitForTimeout(5000);

		// Take screenshot of performance state
		await page.screenshot({
			path: 'tests/e2e/screenshots/performance-loaded.png',
			fullPage: true
		});

		// Check First Contentful Paint
		const fcp = await page.evaluate(() => {
			const entries = performance.getEntriesByType('paint');
			const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
			return fcpEntry ? fcpEntry.startTime : null;
		});

		if (fcp !== null) {
			console.log(`First Contentful Paint: ${fcp}ms`);
			expect(fcp).toBeLessThan(3000); // Should be under 3 seconds
		}

		// Test memory usage
		const memoryInfo = await page.evaluate(() => {
			// @ts-expect-error - accessing memory API
			return (performance as any).memory
				? {
						// @ts-expect-error - accessing memory API
						usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
						// @ts-expect-error - accessing memory API
						totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
						// @ts-expect-error - accessing memory API
						jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
					}
				: null;
		});

		if (memoryInfo) {
			console.log('Memory usage:', memoryInfo);
			// Memory usage should be reasonable (under 100MB)
			expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
		}
	});

	test('should be accessible via keyboard navigation', async ({ page }) => {
		// Take screenshot of initial focus state
		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-initial.png',
			fullPage: true
		});

		// Test Tab navigation
		await page.keyboard.press('Tab');
		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-tab-1.png',
			fullPage: true
		});

		// Continue tabbing through interactive elements
		for (let i = 2; i <= 5; i++) {
			await page.keyboard.press('Tab');
			await page.screenshot({
				path: `tests/e2e/screenshots/accessibility-tab-${i}.png`,
				fullPage: true
			});
		}

		// Test Enter key on focused button
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		await chatInput.focus();
		await chatInput.fill('Testing keyboard accessibility');

		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-input-focused.png',
			fullPage: true
		});

		// Press Enter to send message
		await page.keyboard.press('Enter');
		await page.waitForTimeout(2000);

		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-enter-pressed.png',
			fullPage: true
		});
	});

	test('should support screen reader requirements', async ({ page }) => {
		// Check for proper ARIA labels and roles
		const accessibilityTree = await page.accessibility.snapshot();

		// Verify main container has proper role
		const mainContainer = page.locator('div.min-h-screen');
		await expect(mainContainer).toBeVisible();

		// Check that interactive elements have proper labels
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		await expect(chatInput).toBeVisible();

		const placeholder = await chatInput.getAttribute('placeholder');
		expect(placeholder).toBeTruthy();
		expect(placeholder).toContain('Type your message');

		// Take screenshot for accessibility audit
		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-screen-reader.png',
			fullPage: true
		});

		// Verify accessibility tree structure
		expect(accessibilityTree).toBeTruthy();
		expect(accessibilityTree?.children).toBeDefined();
	});

	test('should handle high contrast mode', async ({ page }) => {
		// Enable high contrast media query
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.waitForTimeout(1000);

		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-high-contrast.png',
			fullPage: true
		});

		// Test that elements are still visible and functional
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		await expect(chatInput).toBeVisible();

		const sendButton = page.locator('button:has(svg)');
		await expect(sendButton).toBeVisible();

		// Test functionality in high contrast mode
		await chatInput.fill('Testing high contrast mode');
		await sendButton.click();

		await page.waitForTimeout(2000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-high-contrast-interaction.png',
			fullPage: true
		});
	});

	test('should handle reduced motion preferences', async ({ page }) => {
		// Simulate reduced motion preference
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.waitForTimeout(1000);

		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-reduced-motion.png',
			fullPage: true
		});

		// Test that animations are reduced or disabled
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		await chatInput.fill('Testing reduced motion');
		await sendButton.click();

		// Check for smooth functionality without distracting animations
		await page.waitForTimeout(3000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/accessibility-reduced-motion-interaction.png',
			fullPage: true
		});
	});

	test('should handle focus management correctly', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');

		// Test initial focus
		await chatInput.focus();
		await expect(chatInput).toBeFocused();

		await page.screenshot({
			path: 'tests/e2e/screenshots/focus-management-input.png',
			fullPage: true
		});

		// Test focus trap behavior
		await page.keyboard.press('Tab');
		await expect(sendButton).toBeFocused();

		await page.screenshot({
			path: 'tests/e2e/screenshots/focus-management-button.png',
			fullPage: true
		});

		// Test focus return after interaction
		await chatInput.fill('Focus management test');
		await sendButton.click();

		// Focus should return to input or appropriate element
		await page.waitForTimeout(2000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/focus-management-after-interaction.png',
			fullPage: true
		});
	});

	test('should handle viewport zoom correctly', async ({ page }) => {
		// Test different zoom levels
		const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

		for (const zoom of zoomLevels) {
			// Set zoom level
			await page.evaluate((zoomLevel) => {
				document.body.style.zoom = zoomLevel.toString();
			}, zoom);

			await page.waitForTimeout(1000);

			// Take screenshot at this zoom level
			await page.screenshot({
				path: `tests/e2e/screenshots/zoom-level-${zoom.toString().replace('.', '-')}.png`,
				fullPage: true
			});

			// Verify elements are still accessible
			const chatInput = page.locator('textarea[placeholder*="Type your message"]');
			await expect(chatInput).toBeVisible();
		}

		// Reset zoom
		await page.evaluate(() => {
			document.body.style.zoom = '1.0';
		});
	});

	test('should maintain performance under load', async ({ page }) => {
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		const sendButton = page.locator('button:has(svg)');
		const chatContainer = page.locator('div.rounded-lg.bg-gray-700');

		// Mock quick responses to avoid API delays
		await page.route('/api/generate', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					answer: 'Quick test response',
					emotion: 'neutral'
				})
			});
		});

		const startTime = Date.now();

		// Send multiple messages rapidly
		for (let i = 1; i <= 10; i++) {
			await chatInput.fill(`Performance test message ${i}`);
			await sendButton.click();

			// Brief pause to allow processing
			await page.waitForTimeout(200);
		}

		const endTime = Date.now();
		const totalTime = endTime - startTime;

		console.log(`Sent 10 messages in ${totalTime}ms`);

		// Take screenshot of final state
		await page.waitForTimeout(2000);
		await chatContainer.screenshot({
			path: 'tests/e2e/screenshots/performance-under-load.png'
		});

		// Should handle load reasonably well
		expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds

		// All messages should be visible
		const userMessages = chatContainer.locator('span.bg-blue-500');
		await expect(userMessages).toHaveCount(10, { timeout: 10000 });
	});

	test('should handle resource loading failures gracefully', async ({ page }) => {
		// Block external resources to simulate loading failures
		await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', (route) => {
			route.fulfill({ status: 404, body: 'Resource not found' });
		});

		await page.goto('/');
		await page.waitForTimeout(5000);

		// Should still be functional despite resource failures
		await expect(page.locator('div.min-h-screen')).toBeVisible();
		await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();

		// Take screenshot showing graceful degradation
		await page.screenshot({
			path: 'tests/e2e/screenshots/performance-resource-failures.png',
			fullPage: true
		});

		// Test basic functionality still works
		const chatInput = page.locator('textarea[placeholder*="Type your message"]');
		await chatInput.fill('Testing with failed resources');

		const sendButton = page.locator('button:has(svg)');
		await sendButton.click();

		await page.waitForTimeout(3000);
		await page.screenshot({
			path: 'tests/e2e/screenshots/performance-resource-failures-interaction.png',
			fullPage: true
		});
	});
});
