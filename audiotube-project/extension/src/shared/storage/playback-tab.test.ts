import { describe, expect, it } from 'vitest';
import { isPlayState, parsePlaybackTab } from './playback-tab';

const valid = {
	tabId: 4,
	windowId: 2,
	state: 'playing',
	stateAt: 1_700_000_000_000,
	positionSec: 33.5,
	rate: 1.25
};

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

describe('parsePlaybackTab defaults', () => {
	it('reads a missing or bad position as 0 and a missing or bad rate as 1', () => {
		const { positionSec: _p, rate: _r, ...older } = valid;
		void _p;
		void _r;
		expect(parsePlaybackTab(older)).toMatchObject({ positionSec: 0, rate: 1 });
		expect(parsePlaybackTab({ ...valid, positionSec: -3, rate: 0 })).toMatchObject({
			positionSec: 0,
			rate: 1
		});
		expect(parsePlaybackTab({ ...valid, rate: 40 })).toMatchObject({ rate: 1 });
	});
});

describe('isPlayState', () => {
	it('knows the four states', () => {
		for (const state of ['playing', 'paused', 'buffering', 'ended'])
			expect(isPlayState(state)).toBe(true);
		expect(isPlayState('stopped')).toBe(false);
	});
});
