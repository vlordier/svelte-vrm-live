import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['src/test/setup.ts'],
		coverage: {
			include: ['src/**/*.{js,ts,svelte}'],
			exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/test/**/*', 'src/**/*.d.ts', 'src/app.html'],
			reporter: ['text', 'json', 'html'],
			thresholds: {
				global: {
					branches: 70,
					functions: 70,
					lines: 70,
					statements: 70
				}
			}
		},
		globals: true,
		restoreMocks: true
	}
});
