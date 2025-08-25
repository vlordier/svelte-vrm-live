import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		target: 'esnext' // Enable top-level await support
	},
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext'
		}
	},
	server: {
		watch: {
			ignored: ['**/python-services/**', '**/.tts-cache/**', '**/logs/**', '**/*.py', '**/*.log']
		}
	}
});
