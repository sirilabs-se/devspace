import { describe, expect, it } from 'vitest';
import type { PlaybackTab } from '../../shared';
import { computeProgress, formatClock } from './progress';

const video = { positionSec: 100, durationSec: 600, isLive: false };
const tab = (patch: Partial<PlaybackTab> = {}): PlaybackTab => ({
	tabId: 1,
	windowId: 1,
	state: 'playing',
	stateAt: 10_000,
	positionSec: 100,
	rate: 1,
	...patch
});

describe('formatClock', () => {
	it('shows minutes and seconds, and hours when there are some', () => {
		expect(formatClock(4886)).toBe('1:21:26');
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(75)).toBe('1:15');
		expect(formatClock(3600)).toBe('1:00:00');
		expect(formatClock(3725.9)).toBe('1:02:05');
		expect(formatClock(-5)).toBe('0:00');
	});
});

describe('computeProgress', () => {
	it('counts forward one second per second while playing', () => {
		expect(computeProgress(video, tab(), 10_000).elapsedSec).toBe(100);
		expect(computeProgress(video, tab(), 11_000).elapsedSec).toBe(101);
		expect(computeProgress(video, tab(), 15_400).elapsedSec).toBe(105);
	});

	it('counts at the playback rate', () => {
		expect(computeProgress(video, tab({ rate: 2 }), 13_000).elapsedSec).toBe(106);
		expect(computeProgress(video, tab({ rate: 0.5 }), 14_000).elapsedSec).toBe(102);
	});

	it('does not move while paused, buffering or ended', () => {
		for (const state of ['paused', 'buffering', 'ended'] as const) {
			expect(computeProgress(video, tab({ state }), 99_000).elapsedSec).toBe(100);
		}
	});

	it('says buffering only while buffering', () => {
		expect(computeProgress(video, tab({ state: 'buffering' }), 10_000).buffering).toBe(true);
		expect(computeProgress(video, tab(), 10_000).buffering).toBe(false);
	});

	it('never goes past the duration', () => {
		const p = computeProgress(video, tab({ positionSec: 590 }), 60_000);
		expect(p.elapsedSec).toBe(600);
		expect(p.elapsedText).toBe('10:00');
		expect(p.durationText).toBe('10:00');
		expect(p.fraction).toBe(1);
	});

	it('never goes below zero', () => {
		expect(
			computeProgress(video, tab({ positionSec: 0, stateAt: 50_000 }), 10_000).elapsedSec
		).toBe(0);
	});

	it('shows the saved position, still, when there is no playback tab', () => {
		const p = computeProgress({ ...video, positionSec: 750, durationSec: 1000 }, null, 99_999);
		expect(p.elapsedSec).toBe(750);
		expect(p.elapsedText).toBe('12:30');
		expect(p.durationText).toBe('16:40');
	});

	it('gives the length of the video, which stays the same as the time passes, and the fraction', () => {
		const p = computeProgress(video, tab(), 10_000);
		expect(p.durationText).toBe('10:00');
		expect(computeProgress(video, tab(), 70_000).durationText).toBe('10:00');
		expect(p.fraction).toBeCloseTo(100 / 600);
	});

	it('has no times for a live stream', () => {
		const p = computeProgress({ ...video, isLive: true, durationSec: null }, tab(), 20_000);
		expect(p).toMatchObject({
			live: true,
			durationSec: null,
			fraction: null,
			durationText: null
		});
	});

	it('has no length shown when the duration is not known', () => {
		const p = computeProgress({ ...video, durationSec: null }, tab(), 12_000);
		expect(p.elapsedSec).toBe(102);
		expect(p.durationText).toBeNull();
		expect(p.fraction).toBeNull();
	});
});
