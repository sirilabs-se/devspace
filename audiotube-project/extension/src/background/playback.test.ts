import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerReport } from '../shared';
import {
	checkPlaybackTab,
	handlePlayerReport,
	resumePlayback,
	watchPlaybackTabLoss
} from './playback';

type Store = Map<string, unknown>;
let local: Store;
let session: Store;
const update = vi.fn();
const sendMessage = vi.fn();
let onRemoved: (tabId: number) => void;
let onReplaced: (addedTabId: number, removedTabId: number) => void;
let onUpdated: (tabId: number, info: { status?: string; discarded?: boolean }) => void;
const tabsGet = vi.fn();
const tabsCreate = vi.fn();

function area(store: Store) {
	return {
		get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
		set: async (items: Record<string, unknown>) => {
			for (const [k, v] of Object.entries(items)) store.set(k, v);
		},
		remove: async (key: string | string[]) => {
			for (const k of Array.isArray(key) ? key : [key]) store.delete(k);
		}
	};
}

beforeEach(() => {
	local = new Map();
	session = new Map();
	update.mockReset().mockResolvedValue({});
	sendMessage.mockReset().mockResolvedValue(undefined);
	tabsGet.mockReset().mockResolvedValue({
		id: 1,
		status: 'complete',
		discarded: false,
		url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
	});
	tabsCreate.mockReset().mockResolvedValue({ id: 50, windowId: 12 });
	vi.stubGlobal('chrome', {
		storage: { local: area(local), session: area(session) },
		tabs: {
			update,
			sendMessage,
			get: tabsGet,
			create: tabsCreate,
			onRemoved: { addListener: (l: typeof onRemoved) => (onRemoved = l) },
			onUpdated: { addListener: (l: typeof onUpdated) => (onUpdated = l) },
			onReplaced: { addListener: (l: typeof onReplaced) => (onReplaced = l) }
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

	it('pauses the old playback tab, never closes it, and moves the discard mark', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 30), TAB_A, NOW);
		await handlePlayerReport(
			video({ videoId: 'jNQXAC9IVRw', title: 'Me at the zoo' }),
			TAB_B,
			NOW + 1000
		);
		await handlePlayerReport(state('playing', 2), TAB_B, NOW + 2000);

		expect(session.get('playbackTab')).toMatchObject({ tabId: 2, windowId: 11, state: 'playing' });
		expect(local.get('nowPlaying')).toMatchObject({ videoId: 'jNQXAC9IVRw', positionSec: 2 });
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(sendMessage).toHaveBeenCalledWith(1, { type: 'player/command', command: 'pause' });
		expect(update).toHaveBeenCalledWith(1, { autoDiscardable: true });
		expect(update).toHaveBeenCalledWith(2, { autoDiscardable: false });
	});

	it('does not pause the same tab when it reports playing again', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 1), TAB_A, NOW);
		await handlePlayerReport(state('paused', 4), TAB_A, NOW + 1000);
		await handlePlayerReport(state('playing', 4), TAB_A, NOW + 2000);
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('does not let a tab that only loads or pauses a video take over', async () => {
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 30), TAB_A, NOW);
		await handlePlayerReport(video({ videoId: 'jNQXAC9IVRw' }), TAB_B, NOW + 1000);
		await handlePlayerReport(state('paused', 0), TAB_B, NOW + 1500);
		await handlePlayerReport(state('buffering', 0), TAB_B, NOW + 1600);
		await handlePlayerReport(position(5), TAB_B, NOW + 1700);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
		expect(local.get('nowPlaying')).toMatchObject({ videoId: 'aqz-KE-bpKQ' });
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('carries on when the old tab cannot be reached', async () => {
		sendMessage.mockRejectedValue(new Error('Could not establish connection'));
		await handlePlayerReport(video(), TAB_A, NOW);
		await handlePlayerReport(state('playing', 30), TAB_A, NOW);
		await handlePlayerReport(video({ videoId: 'jNQXAC9IVRw' }), TAB_B, NOW + 1000);
		await handlePlayerReport(state('playing', 0), TAB_B, NOW + 2000);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 2 });
	});

	it('applies reports one after another', async () => {
		const reports = [video(), state('playing', 1), position(6), position(11), state('paused', 12)];
		await Promise.all(reports.map((r, i) => handlePlayerReport(r, TAB_A, NOW + i)));
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 12 });
		expect(session.get('playbackTab')).toMatchObject({ state: 'paused' });
	});
});

async function playing(tab = TAB_A, position = 90) {
	await handlePlayerReport(video(), tab, NOW);
	await handlePlayerReport(state('playing', position), tab, NOW);
	await handlePlayerReport(
		position === 0
			? state('playing', 0)
			: position === 90
				? ({ type: 'player/position', positionSec: 750 } as PlayerReport)
				: state('playing', position),
		tab,
		NOW + 1000
	);
}

describe('losing the playback tab', () => {
	beforeEach(() => {
		watchPlaybackTabLoss();
	});

	it('keeps Now Playing with its position when the tab is closed', async () => {
		await playing();
		onRemoved(1);
		await vi.waitFor(() => expect(session.has('playbackTab')).toBe(false));
		expect(local.get('nowPlaying')).toMatchObject({ videoId: 'aqz-KE-bpKQ', positionSec: 750 });
	});

	it('treats a tab that loads a page on another site as lost, once it has been looked at', async () => {
		vi.useFakeTimers();
		await playing();
		tabsGet.mockResolvedValue({ id: 1, status: 'complete', discarded: false, url: undefined });
		onUpdated(1, { status: 'loading' });
		await vi.advanceTimersByTimeAsync(3000);
		expect(session.has('playbackTab')).toBe(false);
		expect(local.has('nowPlaying')).toBe(true);
		vi.useRealTimers();
	});

	it('keeps the playback tab when YouTube moves on within the page, which also raises a load', async () => {
		vi.useFakeTimers();
		await playing();
		tabsGet.mockResolvedValue({
			id: 1,
			status: 'complete',
			discarded: false,
			url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
		});
		onUpdated(1, { status: 'loading' });
		await vi.advanceTimersByTimeAsync(3000);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
		vi.useRealTimers();
	});

	it('keeps a tab that is still loading its YouTube page when the look comes', async () => {
		vi.useFakeTimers();
		await playing();
		tabsGet.mockResolvedValue({
			id: 1,
			status: 'loading',
			discarded: false,
			url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
		});
		onUpdated(1, { status: 'loading' });
		await vi.advanceTimersByTimeAsync(3000);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
		vi.useRealTimers();
	});

	it('treats a discarded playback tab as lost', async () => {
		await playing();
		onUpdated(1, { discarded: true });
		await vi.waitFor(() => expect(session.has('playbackTab')).toBe(false));
	});

	it('treats the playback tab being replaced, as a discard does with a new tab ID, as lost', async () => {
		await playing();
		onReplaced(99, 1);
		await vi.waitFor(() => expect(session.has('playbackTab')).toBe(false));
		expect(local.has('nowPlaying')).toBe(true);
	});

	it('does nothing when a tab that is not the playback tab goes', async () => {
		await playing();
		onRemoved(2);
		onUpdated(2, { discarded: true });
		await new Promise((r) => setTimeout(r, 20));
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
	});

	it('leaves the playback tab alone for other updates', async () => {
		await playing();
		onUpdated(1, { status: 'complete' });
		await new Promise((r) => setTimeout(r, 20));
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
	});

	it('does not close, reload or navigate any tab', async () => {
		await playing();
		onRemoved(1);
		await vi.waitFor(() => expect(session.has('playbackTab')).toBe(false));
		expect(update).not.toHaveBeenCalledWith(1, expect.objectContaining({ url: expect.anything() }));
	});
});

describe('the main player going away', () => {
	it('saves the last position and forgets the playback tab, keeping Now Playing', async () => {
		await playing();
		await handlePlayerReport({ type: 'player/gone', positionSec: 800 }, TAB_A, NOW + 9000);
		expect(session.has('playbackTab')).toBe(false);
		expect(local.get('nowPlaying')).toMatchObject({ videoId: 'aqz-KE-bpKQ', positionSec: 800 });
	});

	it('ignores it from a tab that is not the playback tab', async () => {
		await playing();
		await handlePlayerReport({ type: 'player/gone', positionSec: 5 }, TAB_B, NOW + 9000);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 750 });
	});
});

describe('checkPlaybackTab', () => {
	it('keeps a tab that is there', async () => {
		await playing();
		await checkPlaybackTab();
		expect(session.get('playbackTab')).toMatchObject({ tabId: 1 });
	});

	it('loses a tab that cannot be found, is unloaded after a crash, or is discarded', async () => {
		for (const result of [
			() => Promise.reject(new Error('No tab with id')),
			() => Promise.resolve({ id: 1, status: 'unloaded', discarded: false }),
			() => Promise.resolve({ id: 1, status: 'complete', discarded: true }),
			() => Promise.resolve({ id: 1, status: 'complete', discarded: false }),
			() =>
				Promise.resolve({
					id: 1,
					status: 'complete',
					discarded: false,
					url: 'https://example.com/'
				})
		]) {
			session.clear();
			local.clear();
			await playing();
			tabsGet.mockImplementation(result);
			await checkPlaybackTab();
			expect(session.has('playbackTab')).toBe(false);
			expect(local.has('nowPlaying')).toBe(true);
		}
	});

	it('does nothing when there is no playback tab', async () => {
		await checkPlaybackTab();
		expect(tabsGet).not.toHaveBeenCalled();
	});
});

describe('resumePlayback', () => {
	const stored = {
		videoId: 'aqz-KE-bpKQ',
		title: 'Big Buck Bunny',
		channel: 'Blender',
		durationSec: 635,
		isLive: false,
		positionSec: 750,
		positionSavedAt: NOW,
		updatedAt: NOW
	};

	it('opens the video at its saved position in a background tab', async () => {
		local.set('nowPlaying', stored);
		expect(await resumePlayback(NOW + 5000)).toBe('ok');
		expect(tabsCreate).toHaveBeenCalledWith({
			url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=750s',
			active: false
		});
	});

	it('opens a live stream without a start time', async () => {
		local.set('nowPlaying', { ...stored, isLive: true, durationSec: null, positionSec: 5000 });
		expect(await resumePlayback(NOW + 5000)).toBe('ok');
		expect(tabsCreate).toHaveBeenCalledWith({
			url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
			active: false
		});
	});

	it('records the new tab as the playback tab at once, paused, and not discardable', async () => {
		local.set('nowPlaying', stored);
		await resumePlayback(NOW + 5000);
		expect(session.get('playbackTab')).toEqual({
			tabId: 50,
			windowId: 12,
			state: 'paused',
			stateAt: NOW + 5000
		});
		expect(session.get('resume')).toEqual({ tabId: 50, startedAt: NOW + 5000 });
		expect(update).toHaveBeenCalledWith(50, { autoDiscardable: false });
	});

	it('has nothing to resume when nothing has played', async () => {
		expect(await resumePlayback()).toBe('nothing-to-resume');
		expect(tabsCreate).not.toHaveBeenCalled();
	});

	it('does not open a second tab when there is already a playback tab', async () => {
		local.set('nowPlaying', stored);
		session.set('playbackTab', { tabId: 7, windowId: 1, state: 'paused', stateAt: NOW });
		expect(await resumePlayback()).toBe('ok');
		expect(tabsCreate).not.toHaveBeenCalled();
	});

	it('is not undone by the new tab loading, but clears its waiting mark when it plays', async () => {
		vi.useRealTimers();
		watchPlaybackTabLoss();
		local.set('nowPlaying', stored);
		await resumePlayback(Date.now());
		onUpdated(50, { status: 'loading' });
		await new Promise((r) => setTimeout(r, 20));
		expect(session.get('playbackTab')).toMatchObject({ tabId: 50 });

		await handlePlayerReport(video(), { tabId: 50, windowId: 12 }, NOW);
		await handlePlayerReport(state('playing', 751), { tabId: 50, windowId: 12 }, NOW + 1000);
		expect(session.has('resume')).toBe(false);
		expect(session.get('playbackTab')).toMatchObject({ tabId: 50, state: 'playing' });
		expect(local.get('nowPlaying')).toMatchObject({ videoId: 'aqz-KE-bpKQ', positionSec: 751 });
	});

	it('keeps the saved position when the resumed page first reports a paused state at 0', async () => {
		local.set('nowPlaying', stored);
		await resumePlayback(NOW + 5000);
		await handlePlayerReport(video(), { tabId: 50, windowId: 12 }, NOW + 6000);
		await handlePlayerReport(state('paused', 0), { tabId: 50, windowId: 12 }, NOW + 6100);
		expect(local.get('nowPlaying')).toMatchObject({ positionSec: 750 });
	});
});
