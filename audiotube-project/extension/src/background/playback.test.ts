import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerReport } from '../shared';
import { handlePlayerReport, forgetVideosOfGoneTabs } from './playback';

type Store = Map<string, unknown>;
let local: Store;
let session: Store;
const update = vi.fn();
let onRemoved: (tabId: number) => void;
let onUpdated: (tabId: number, info: { status?: string }) => void;

function area(store: Store) {
	return {
		get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
		set: async (items: Record<string, unknown>) => {
			for (const [k, v] of Object.entries(items)) store.set(k, v);
		},
		remove: async (key: string) => void store.delete(key)
	};
}

beforeEach(() => {
	local = new Map();
	session = new Map();
	update.mockReset().mockResolvedValue({});
	vi.stubGlobal('chrome', {
		storage: { local: area(local), session: area(session) },
		tabs: {
			update,
			onRemoved: { addListener: (l: typeof onRemoved) => (onRemoved = l) },
			onUpdated: { addListener: (l: typeof onUpdated) => (onUpdated = l) }
		}
	});
});

afterEach(() => vi.unstubAllGlobals());

const TAB_A = { tabId: 1, windowId: 10 };
const TAB_B = { tabId: 2, windowId: 11 };
const NOW = 1_700_000_000_000;

const video = (
	patch: Partial<Extract<PlayerReport, { type: 'player/video' }>> = {}
): PlayerReport => ({
	type: 'player/video',
	videoId: 'aqz-KE-bpKQ',
	title: 'Big Buck Bunny',
	channel: 'Blender',
	durationSec: 635,
	isLive: false,
	...patch
});
const state = (s: 'playing' | 'paused' | 'buffering' | 'ended', positionSec = 0): PlayerReport => ({
	type: 'player/state',
	state: s,
	positionSec
});
const position = (positionSec: number): PlayerReport => ({ type: 'player/position', positionSec });

describe('handlePlayerReport', () => {
	it('stores Now Playing and makes the tab the playback tab when it starts playing', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 7), TAB_A, NOW + 1000);
		expect(local.get('nowPlaying')).toEqual({
			videoId: 'aqz-KE-bpKQ',
			title: 'Big Buck Bunny',
			channel: 'Blender',
			durationSec: 635,
			isLive: false,
			positionSec: 7,
			positionSavedAt: NOW + 1000,
			updatedAt: NOW + 1000
		});
		expect(session.get('playbackTab')).toEqual({
			tabId: 1,
			windowId: 10,
			state: 'playing',
			stateAt: NOW + 1000
		});
		expect(update).toHaveBeenCalledWith(1, { autoDiscardable: false });
	});

	it('stores nothing while the video is only loaded, not playing', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('paused'), TAB_A, NOW);
		expect(local.has('nowPlaying')).toBe(false);
		expect(session.has('playbackTab')).toBe(false);
	});

	it('ignores a playing report that has no video before it', async () => {
		await handlePlayerReport(state('playing', 3), TAB_A, NOW);
		expect(local.has('nowPlaying')).toBe(false);
		expect(session.has('playbackTab')).toBe(false);
	});

	it('stores the state and position when the playback tab pauses', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 5), TAB_A, NOW);
		await handlePlayerReport(state('paused', 42), TAB_A, NOW + 9000);
		expect(session.get('playbackTab')).toMatchObject({ state: 'paused', stateAt: NOW + 9000 });
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 42, positionSavedAt: NOW + 9000 });
	});

	it('saves the position from the playback tab, and ignores it from any other tab', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 0), TAB_A, NOW);
		await handlePlayerReport(position(30), TAB_A, NOW + 5000);
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 30, positionSavedAt: NOW + 5000 });
		await handlePlayerReport(position(99), TAB_B, NOW + 6000);
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 30 });
	});

	it('cuts a title and a channel to their caps and strips control characters', async () => {
		await handlePlayerReport(
			video({ title: `T\u0000${'x'.repeat(500)}`, channel: 'C'.repeat(300) }),
			TAB_A,
			NOW
		);
		await handlePlayerReport(state('playing'), TAB_A, NOW);
		const stored = local.get('nowPlaying') as { title: string; channel: string };
		expect(stored.title).toHaveLength(300);
		expect(stored.title.startsWith('T ')).toBe(true);
		expect(stored.channel).toHaveLength(100);
	});

	it('keeps markup as plain text', async () => {
		await handlePlayerReport(video({ title: '<b>bold</b>' }), TAB_A, NOW);
		await handlePlayerReport(state('playing'), TAB_A, NOW);
		expect(local.get('nowPlaying')).toMatchObject({ title: '<b>bold</b>' });
	});

	it('has no duration for a live stream', async () => {
		await handlePlayerReport(video({ isLive: true, durationSec: 999 }), TAB_A, NOW);
		await handlePlayerReport(state('playing'), TAB_A, NOW);
		expect(local.get('nowPlaying')).toMatchObject({ isLive: true, durationSec: null });
	});

	it('replaces Now Playing when the playback tab opens a different video', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 20), TAB_A, NOW);
		await handlePlayerReport(
			video({ videoId: 'jNQXAC9IVRw', title: 'Me at the zoo' }),
			TAB_A,
			NOW + 4000
		);
		expect(local.get('nowPlaying')).toMatchObject({
			videoId: 'jNQXAC9IVRw',
			title: 'Me at the zoo',
			positionSec: 0,
			updatedAt: NOW + 4000
		});
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
	});

	it('keeps the position when the same video only gets new details', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 20), TAB_A, NOW);
		await handlePlayerReport(video({ title: 'Big Buck Bunny (HD)' }), TAB_A, NOW + 2000);
		expect(local.get('nowPlaying')).toMatchObject({
			title: 'Big Buck Bunny (HD)',
			positionSec: 20,
			updatedAt: NOW
		});
	});

	it('applies reports one after another', async () => {
		const reports = [video(), state('playing', 1), position(6), position(11), state('paused', 12)];
		await Promise.all(reports.map((r, i) => handlePlayerReport(r, TAB_A, NOW + i)));
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 12 });
		expect(session.get('playbackTab')).toMatchObject({ state: 'paused' });
	});
});

describe('forgetVideosOfGoneTabs', () => {
	it('forgets the video of a closed tab, and of a tab that starts loading', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		expect(session.has('tabVideo:1')).toBe(true);
		forgetVideosOfGoneTabs();
		onUpdated(1, { status: 'complete' });
		expect(session.has('tabVideo:1')).toBe(true);
		onUpdated(1, { status: 'loading' });
		await vi.waitFor(() => expect(session.has('tabVideo:1')).toBe(false));
		await handlePlayerReport(video(), TAB_A, NOW);
		onRemoved(1);
		await vi.waitFor(() => expect(session.has('tabVideo:1')).toBe(false));
	});
});
