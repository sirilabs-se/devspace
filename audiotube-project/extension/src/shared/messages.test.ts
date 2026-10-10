import { describe, expect, it } from 'vitest';
import { isBackgroundRequest, isPlayerReport, isTabCommand } from './messages';

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
		expect(
			isPlayerReport({ type: 'player/state', state: 'playing', positionSec: 3, rate: 1.5 })
		).toBe(true);
		expect(isPlayerReport({ type: 'player/position', positionSec: 8 })).toBe(true);
		expect(isPlayerReport({ type: 'player/gone', positionSec: 8 })).toBe(true);
		expect(isPlayerReport({ ...video, durationSec: null, isLive: true })).toBe(true);
	});

	it('rejects a bad video id, text that is not text, and numbers that are not seconds', () => {
		expect(isPlayerReport({ ...video, videoId: 'x' })).toBe(false);
		expect(isPlayerReport({ ...video, title: 5 })).toBe(false);
		expect(isPlayerReport({ ...video, title: 'x'.repeat(5000) })).toBe(false);
		expect(isPlayerReport({ ...video, isLive: 'yes' })).toBe(false);
		expect(
			isPlayerReport({ type: 'player/state', state: 'dancing', positionSec: 1, rate: 1 })
		).toBe(false);
		expect(isPlayerReport({ type: 'player/state', state: 'playing', positionSec: 1 })).toBe(false);
		expect(
			isPlayerReport({ type: 'player/state', state: 'playing', positionSec: 1, rate: 0 })
		).toBe(false);
		expect(
			isPlayerReport({ type: 'player/state', state: 'playing', positionSec: 1, rate: 99 })
		).toBe(false);
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
		expect(isBackgroundRequest({ type: 'player/state', state: 'x', positionSec: 1, rate: 1 })).toBe(
			false
		);
		expect(isBackgroundRequest('hello')).toBe(false);
	});
});

describe('volume messages', () => {
	it('accepts a volume report and a set-volume request and command', () => {
		expect(isPlayerReport({ type: 'player/volume', level: 40, muted: false })).toBe(true);
		expect(isBackgroundRequest({ type: 'player/set-volume', level: 40, muted: true })).toBe(true);
		expect(isTabCommand({ type: 'player/set-volume', level: 0, muted: false })).toBe(true);
		expect(isBackgroundRequest({ type: 'player/volume', level: 40, muted: false })).toBe(true);
	});

	it('rejects a level that is not a whole number from 0 to 100, or a mute that is not a boolean', () => {
		for (const level of [-1, 101, 50.5, '50', undefined, NaN]) {
			expect(isPlayerReport({ type: 'player/volume', level, muted: false })).toBe(false);
			expect(isBackgroundRequest({ type: 'player/set-volume', level, muted: false })).toBe(false);
			expect(isTabCommand({ type: 'player/set-volume', level, muted: false })).toBe(false);
		}
		expect(isPlayerReport({ type: 'player/volume', level: 10, muted: 'yes' })).toBe(false);
		expect(isBackgroundRequest({ type: 'player/set-volume', level: 10 })).toBe(false);
	});
});

describe('seek messages', () => {
	it('accepts a seek request with a position, from the panel and to a tab', () => {
		expect(isBackgroundRequest({ type: 'player/seek', positionSec: 90 })).toBe(true);
		expect(isTabCommand({ type: 'player/seek', positionSec: 90 })).toBe(true);
	});

	it('rejects a seek without a usable position', () => {
		for (const positionSec of [undefined, -1, 'soon', Infinity, NaN]) {
			expect(isBackgroundRequest({ type: 'player/seek', positionSec })).toBe(false);
			expect(isTabCommand({ type: 'player/seek', positionSec })).toBe(false);
		}
	});
});

describe('isTabCommand', () => {
	it('accepts play and pause only', () => {
		expect(isTabCommand({ type: 'player/command', command: 'pause' })).toBe(true);
		expect(isTabCommand({ type: 'player/command', command: 'play' })).toBe(true);
		expect(isTabCommand({ type: 'player/command', command: 'seek' })).toBe(false);
		expect(isTabCommand({ type: 'player/other', command: 'pause' })).toBe(false);
		expect(isTabCommand(null)).toBe(false);
	});
});
