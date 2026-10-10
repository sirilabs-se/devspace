import { describe, expect, it } from 'vitest';
import { isBackgroundRequest, isPlayerReport } from './messages';

const video = {
	type: 'player/video',
	videoId: 'aqz-KE-bpKQ',
	title: 'Big Buck Bunny',
	channel: 'Blender',
	durationSec: 635,
	isLive: false
};

describe('isPlayerReport', () => {
	it('accepts the three report shapes', () => {
		expect(isPlayerReport(video)).toBe(true);
		expect(isPlayerReport({ type: 'player/state', state: 'playing', positionSec: 3 })).toBe(true);
		expect(isPlayerReport({ type: 'player/position', positionSec: 8 })).toBe(true);
		expect(isPlayerReport({ ...video, durationSec: null, isLive: true })).toBe(true);
	});

	it('rejects a bad video id, text that is not text, and numbers that are not seconds', () => {
		expect(isPlayerReport({ ...video, videoId: 'x' })).toBe(false);
		expect(isPlayerReport({ ...video, title: 5 })).toBe(false);
		expect(isPlayerReport({ ...video, title: 'x'.repeat(5000) })).toBe(false);
		expect(isPlayerReport({ ...video, isLive: 'yes' })).toBe(false);
		expect(isPlayerReport({ type: 'player/state', state: 'dancing', positionSec: 1 })).toBe(false);
		expect(isPlayerReport({ type: 'player/position', positionSec: -1 })).toBe(false);
		expect(isPlayerReport({ type: 'player/position', positionSec: Infinity })).toBe(false);
		expect(isPlayerReport({ type: 'player/other' })).toBe(false);
		expect(isPlayerReport(null)).toBe(false);
	});
});

describe('isBackgroundRequest', () => {
	it('accepts every request the background handles', () => {
		expect(isBackgroundRequest({ type: 'settings/set-audio-only', value: false })).toBe(true);
		expect(isBackgroundRequest({ type: 'overlay/status', status: 'failed' })).toBe(true);
		expect(isBackgroundRequest(video)).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isBackgroundRequest({ type: 'overlay/status', status: 'meh' })).toBe(false);
		expect(isBackgroundRequest({ type: 'player/state', state: 'x', positionSec: 1 })).toBe(false);
		expect(isBackgroundRequest('hello')).toBe(false);
	});
});
