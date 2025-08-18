import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	{
		files: ['**/*.{ts,js}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module'
			},
			globals: {
				console: 'readonly',
				fetch: 'readonly',
				setTimeout: 'readonly',
				crypto: 'readonly',
				atob: 'readonly',
				AudioContext: 'readonly',
				AudioBuffer: 'readonly',
				Request: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				window: 'readonly',
				navigator: 'readonly',
				performance: 'readonly',
				SpeechSynthesisUtterance: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': ts
		},
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-console': 'off',
			'no-async-promise-executor': 'warn',
			'no-useless-escape': 'warn'
		}
	},
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			globals: {
				console: 'readonly',
				fetch: 'readonly',
				setTimeout: 'readonly',
				crypto: 'readonly',
				localStorage: 'readonly',
				HTMLDivElement: 'readonly',
				Request: 'readonly'
			},
			parserOptions: {
				parser: '@typescript-eslint/parser',
				extraFileExtensions: ['.svelte']
			}
		}
	},
	prettier,
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'*.d.ts',
			'vite.config.ts',
			'vitest.config.ts',
			'playwright.config.ts',
			'tailwind.config.ts',
			'static/**/*',
			'**/*.svelte.ts'
		]
	},
	{
		files: ['**/*.test.{js,ts}', 'src/test/**/*.{js,ts}'],
		languageOptions: {
			globals: {
				global: 'readonly',
				globalThis: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				vi: 'readonly'
			}
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off' // Allow any in tests for mocking
		}
	},
	{
		files: ['tests/e2e/**/*.{js,ts}'],
		languageOptions: {
			globals: {
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
				navigator: 'readonly',
				performance: 'readonly',
				PerformanceObserver: 'readonly',
				CSS: 'readonly',
				HTMLCanvasElement: 'readonly',
				Buffer: 'readonly'
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_|^chatContainer$' }],
			'@typescript-eslint/no-explicit-any': 'off'
		}
	},
	{
		files: ['scripts/**/*.{js,ts}'],
		languageOptions: {
			globals: {
				process: 'readonly'
			}
		}
	}
];
