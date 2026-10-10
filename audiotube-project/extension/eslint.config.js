import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	{
		ignores: ['_prototype/', 'dist/', 'node_modules/', 'test-results/', 'playwright-report/']
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		// chrome.storage: only background/ writes; only the settings helper in shared/ reads.
		files: ['src/**/*.{ts,js,svelte}'],
		ignores: ['src/background/**', 'src/shared/settings/**', 'src/**/*.test.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "MemberExpression[object.name='chrome'][property.name='storage']",
					message:
						'Do not use chrome.storage here. Read stored values through the settings read helper in shared/; only background/ writes.'
				}
			]
		}
	},
	{
		files: ['src/shared/settings/**'],
		ignores: ['src/**/*.test.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector:
						"CallExpression[callee.property.name=/^(set|remove|clear)$/] > MemberExpression.callee > MemberExpression > MemberExpression[object.name='chrome'][property.name='storage']",
					message: 'Only background/ writes to chrome.storage (set, remove, clear).'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
