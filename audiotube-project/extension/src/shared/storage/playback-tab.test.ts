import { describe, expect, it } from 'vitest';
import { isPlayState, parsePlaybackTab } from './playback-tab';

const valid = { tabId: 4, windowId: 2, state: 'playing', stateAt: 1_700_000_000_000 };

describe('parsePlaybackTab', () => {
	it('reads a valid value', () => {
		expect(parsePlaybackTab(valid)).toEqual(valid);
	});

	it('reads anything missing or invalid as no playback tab', () => {
		expect(parsePlaybackTab(undefined)).toBeNull();
		expect(parsePlaybackTab({ ...valid, state: 'dancing' })).toBeNull();
		expect(parsePlaybackTab({ ...valid, tabId: '4' })).toBeNull();
		expect(parsePlaybackTab({ ...valid, windowId: -1 })).toBeNull();
		expect(parsePlaybackTab({ tabId: 1 })).toBeNull();
	});
});

describe('isPlayState', () => {
	it('knows the four states', () => {
		for (const state of ['playing', 'paused', 'buffering', 'ended'])
			expect(isPlayState(state)).toBe(true);
		expect(isPlayState('stopped')).toBe(false);
	});
});
