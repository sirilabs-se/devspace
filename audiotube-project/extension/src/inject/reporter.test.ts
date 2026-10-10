import { describe, expect, it, vi } from 'vitest';
import type { PlayerReport } from '../shared';
import {
	createReporter,
	GONE_AFTER_MS,
	playStateFromNumber,
	type PlayerSnapshot
} from './reporter';

const base: PlayerSnapshot = {
	videoId: 'aqz-KE-bpKQ',
	title: 'Big Buck Bunny',
	channel: 'Blender',
	durationSec: 635,
	isLive: false,
	state: 'paused',
	positionSec: 0,
	rate: 1,
	volume: 80,
	muted: false,
	adPlaying: false
};

function setup() {
	let snapshot: PlayerSnapshot | null = base;
	let now = 1_000;
	const sent: PlayerReport[] = [];
	const reporter = createReporter({
		read: () => snapshot,
		send: (r) => sent.push(r),
		now: () => now
	});
	return {
		sent,
		check: () => reporter.check(),
		set: (patch: Partial<PlayerSnapshot> | null) => {
			snapshot = patch === null ? null : { ...(snapshot ?? base), ...patch };
		},
		advance: (ms: number) => (now += ms)
	};
}

describe('playStateFromNumber', () => {
	it('maps the numbers YouTube uses', () => {
		expect(playStateFromNumber(1)).toBe('playing');
		expect(playStateFromNumber(2)).toBe('paused');
		expect(playStateFromNumber(3)).toBe('buffering');
		expect(playStateFromNumber(0)).toBe('ended');
		expect(playStateFromNumber(-1)).toBe('paused');
		expect(playStateFromNumber(5)).toBe('paused');
		expect(playStateFromNumber(undefined)).toBe('paused');
	});
});

describe('createReporter', () => {
	it('reports the video, then its state, when it first sees a player', () => {
		const t = setup();
		t.check();
		expect(t.sent.map((r) => r.type)).toEqual(['player/video', 'player/state', 'player/volume']);
		expect(t.sent[0]).toMatchObject({
			videoId: 'aqz-KE-bpKQ',
			title: 'Big Buck Bunny',
			channel: 'Blender'
		});
	});

	it('says nothing when nothing changed', () => {
		const t = setup();
		t.check();
		t.sent.length = 0;
		t.check();
		t.check();
		expect(t.sent).toEqual([]);
	});

	it('reports a state change with the position', () => {
		const t = setup();
		t.check();
		t.sent.length = 0;
		t.set({ state: 'playing', positionSec: 12 });
		t.check();
		expect(t.sent).toEqual([{ type: 'player/state', state: 'playing', positionSec: 12, rate: 1 }]);
	});

	it('reports the position every 5 seconds while playing, not before', () => {
		const t = setup();
		t.set({ state: 'playing', positionSec: 0 });
		t.check();
		t.sent.length = 0;
		t.advance(4000);
		t.set({ positionSec: 4 });
		t.check();
		expect(t.sent).toEqual([]);
		t.advance(1000);
		t.set({ positionSec: 5 });
		t.check();
		expect(t.sent).toEqual([{ type: 'player/position', positionSec: 5 }]);
	});

	it('does not report the position while paused', () => {
		const t = setup();
		t.check();
		t.sent.length = 0;
		t.advance(20_000);
		t.check();
		expect(t.sent).toEqual([]);
	});

	it('reports a new video, and new details for the same video', () => {
		const t = setup();
		t.check();
		t.sent.length = 0;
		t.set({ videoId: 'jNQXAC9IVRw', title: 'Me at the zoo' });
		t.check();
		expect(t.sent.map((r) => r.type)).toEqual(['player/video', 'player/state']);
		t.sent.length = 0;
		t.set({ title: 'Me at the zoo (HD)' });
		t.check();
		expect(t.sent[0]).toMatchObject({ type: 'player/video', title: 'Me at the zoo (HD)' });
	});

	it('never reports ad time as the position', () => {
		const t = setup();
		t.set({ state: 'playing', positionSec: 40, adPlaying: false });
		t.check();
		t.sent.length = 0;
		t.advance(6000);
		t.set({ positionSec: 3, adPlaying: true });
		t.check();
		expect(t.sent).toEqual([]);
	});

	it('says the player is gone, with the last position, only after it has been missing a moment', () => {
		const t = setup();
		t.set({ state: 'playing', positionSec: 321 });
		t.check();
		t.sent.length = 0;
		t.set(null);
		t.check();
		expect(t.sent).toEqual([]);
		t.advance(GONE_AFTER_MS - 1);
		t.check();
		expect(t.sent).toEqual([]);
		t.advance(2);
		t.check();
		expect(t.sent).toEqual([{ type: 'player/gone', positionSec: 321 }]);
		t.check();
		expect(t.sent).toHaveLength(1);
	});

	it('does not say gone when the player is back within the moment', () => {
		const t = setup();
		t.set({ state: 'playing', positionSec: 10 });
		t.check();
		t.sent.length = 0;
		t.set(null);
		t.check();
		t.advance(800);
		t.set(base);
		t.set({ state: 'playing' });
		t.check();
		t.advance(2000);
		t.check();
		expect(t.sent.some((r) => r.type === 'player/gone')).toBe(false);
	});

	it('reports the video again when the main player returns after being gone', () => {
		const t = setup();
		t.check();
		t.set(null);
		t.check();
		t.advance(GONE_AFTER_MS + 1);
		t.check();
		t.sent.length = 0;
		t.set(base);
		t.check();
		expect(t.sent.map((r) => r.type)).toEqual(['player/video', 'player/state', 'player/volume']);
	});

	it('does not use ad time as the last position', () => {
		const t = setup();
		t.set({ state: 'playing', positionSec: 100 });
		t.check();
		t.set({ positionSec: 4, adPlaying: true });
		t.check();
		t.sent.length = 0;
		t.set(null);
		t.check();
		t.advance(GONE_AFTER_MS + 1);
		t.check();
		expect(t.sent).toEqual([{ type: 'player/gone', positionSec: 100 }]);
	});

	it('reports the volume when it is first seen, and again only when it or mute changes', () => {
		const t = setup();
		t.check();
		expect(t.sent.filter((r) => r.type === 'player/volume')).toEqual([
			{ type: 'player/volume', level: 80, muted: false }
		]);
		t.sent.length = 0;
		t.check();
		expect(t.sent).toEqual([]);
		t.set({ volume: 35 });
		t.check();
		expect(t.sent).toEqual([{ type: 'player/volume', level: 35, muted: false }]);
		t.sent.length = 0;
		t.set({ muted: true });
		t.check();
		expect(t.sent).toEqual([{ type: 'player/volume', level: 35, muted: true }]);
	});

	it('reports nothing with no player', () => {
		const send = vi.fn();
		createReporter({ read: () => null, send, now: () => 0 }).check();
		expect(send).not.toHaveBeenCalled();
	});
});
