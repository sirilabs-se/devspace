import { describe, expect, it } from 'vitest';
import { isWatchPath } from './watch-page';

describe('isWatchPath', () => {
	it('is true for watch pages and live links', () => {
		expect(isWatchPath('/watch')).toBe(true);
		expect(isWatchPath('/live/abc123')).toBe(true);
	});

	it('is false for every other YouTube page', () => {
		for (const path of [
			'/',
			'/results',
			'/shorts/abc',
			'/@channel',
			'/feed/subscriptions',
			'/embed/abc'
		]) {
			expect(isWatchPath(path)).toBe(false);
		}
	});
});
