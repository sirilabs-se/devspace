import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

// What the architecture checks forbid, as selectors (see docs/architecture.md, Architecture Checks).
const STORAGE_ANY = {
	selector: "MemberExpression[object.name='chrome'][property.name='storage']",
	message:
		'Do not use chrome.storage here. Read stored values through the read helpers in shared/storage; only background/ writes.'
};
const STORAGE_WRITE = {
	selector:
		"CallExpression[callee.property.name=/^(set|remove|clear)$/] > MemberExpression.callee > MemberExpression > MemberExpression[object.name='chrome'][property.name='storage']",
	message: 'Only background/ writes to chrome.storage (set, remove, clear).'
};
const PLAYER_CALL = {
	selector:
		'CallExpression[callee.property.name=/^(playVideo|pauseVideo|stopVideo|seekTo|loadVideoById|cueVideoById|getVideoData|getPlayerState|getCurrentTime|getDuration|getPlaybackQuality|getAvailableQualityLevels|setPlaybackQuality|setPlaybackQualityRange|getVolume|setVolume|isMuted|mute|unMute|setPlaybackRate|getPlaybackRate|nextVideo|previousVideo)$/]',
	message: "Only the page script (src/inject/) calls YouTube's player. Send it a message instead."
};

/** @param {{ selector: string, message: string }[]} selectors */
function restricted(...selectors) {
	return /** @type {['error', ...{ selector: string, message: string }[]]} */ ([
		'error',
		...selectors
	]);
}

/** One block per kind of file, because a later block replaces an earlier one's rule. */
function restrictedSyntax() {
	const tests = 'src/**/*.test.ts';
	const code = ['src/**/*.{ts,js,svelte}'];
	return [
		{
			files: code,
			ignores: ['src/background/**', 'src/inject/**', 'src/shared/storage/**', tests],
			rules: { 'no-restricted-syntax': restricted(STORAGE_ANY, PLAYER_CALL) }
		},
		{
			files: ['src/inject/**'],
			ignores: [tests],
			rules: { 'no-restricted-syntax': restricted(STORAGE_ANY) }
		},
		{
			files: ['src/background/**'],
			ignores: [tests],
			rules: { 'no-restricted-syntax': restricted(PLAYER_CALL) }
		},
		{
			files: ['src/shared/storage/**'],
			ignores: [tests],
			rules: { 'no-restricted-syntax': restricted(STORAGE_WRITE, PLAYER_CALL) }
		}
	];
}

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
	...restrictedSyntax(),
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
