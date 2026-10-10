import { describe, expect, it, vi } from 'vitest';
import type { NowPlaying, PendingResume, PlaybackTab } from '../../shared';
import {
	createNowPlayingController,
	OPTIMISTIC_MS,
	thumbnailUrl,
	type NowPlayingDeps
} from './now-playing';

const nowPlaying: NowPlaying = {
	videoId: 'aqz-KE-bpKQ',
	title: 'Big Buck Bunny',
	channel: 'Blender',
	durationSec: 635,
	isLive: false,
	positionSec: 12,
	positionSavedAt: 1,
	updatedAt: 1
};
const tab = (state: PlaybackTab['state']): PlaybackTab => ({
	tabId: 3,
	windowId: 1,
	state,
	stateAt: 1,
	positionSec: 12,
	rate: 1
});

function setup(
	initial: { now?: NowPlaying | null; tab?: PlaybackTab | null; resume?: PendingResume | null } = {}
) {
	let watchNow!: (v: NowPlaying | null) => void;
	let watchTab!: (v: PlaybackTab | null) => void;
	let watchResume!: (v: PendingResume | null) => void;
	let nowMs = 1_000_000;
	const command = vi.fn<NowPlayingDeps['command']>().mockResolvedValue({ ok: true });
	const stop = vi.fn();
	const controller = createNowPlayingController({
		readNowPlaying: async () => initial.now ?? null,
		watchNowPlaying: (l) => {
			watchNow = l;
			return stop;
		},
		readPlaybackTab: async () => initial.tab ?? null,
		watchPlaybackTab: (l) => {
			watchTab = l;
			return stop;
		},
		readPendingResume: async () => initial.resume ?? null,
		watchPendingResume: (l) => {
			watchResume = l;
			return stop;
		},
		command,
		now: () => nowMs
	});
	return {
		setResume: (v: PendingResume | null) => watchResume(v),
		advance: (ms: number) => (nowMs += ms),
		now: () => nowMs,
		controller,
		command,
		stop,
		setNow: (v: NowPlaying | null) => watchNow(v),
		setTab: (v: PlaybackTab | null) => watchTab(v)
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createNowPlayingController', () => {
	it('is not ready until both stored values are read, then shows nothing playing', async () => {
		const { controller } = setup();
		expect(controller.get().ready).toBe(false);
		await settle();
		expect(controller.get()).toEqual({
			ready: true,
			video: null,
			playing: false,
			canControl: false,
			canResume: false,
			waitingToStart: false,
			progress: null
		});
	});

	it('shows the video with a thumbnail derived from its id', async () => {
		const { controller } = setup({ now: nowPlaying, tab: tab('paused') });
		await settle();
		expect(controller.get().video).toEqual({
			videoId: 'aqz-KE-bpKQ',
			title: 'Big Buck Bunny',
			channel: 'Blender',
			thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg',
			positionText: '0:12'
		});
		expect(thumbnailUrl('abc')).toBe('https://i.ytimg.com/vi/abc/mqdefault.jpg');
	});

	it('follows playing, buffering and paused', async () => {
		const { controller, setTab } = setup({ now: nowPlaying, tab: tab('playing') });
		await settle();
		expect(controller.get().playing).toBe(true);
		setTab(tab('buffering'));
		expect(controller.get().playing).toBe(true);
		setTab(tab('paused'));
		expect(controller.get().playing).toBe(false);
		setTab(tab('ended'));
		expect(controller.get().playing).toBe(false);
	});

	it('can control only while there is a playback tab', async () => {
		const { controller, setTab } = setup({ now: nowPlaying });
		await settle();
		expect(controller.get().canControl).toBe(false);
		setTab(tab('paused'));
		expect(controller.get().canControl).toBe(true);
		setTab(null);
		expect(controller.get().canControl).toBe(false);
	});

	it('sends pause while playing and play while paused', async () => {
		const { controller, command, setTab } = setup({ now: nowPlaying, tab: tab('playing') });
		await settle();
		controller.togglePlayPause();
		expect(command).toHaveBeenLastCalledWith('pause');
		setTab(tab('paused'));
		controller.togglePlayPause();
		expect(command).toHaveBeenLastCalledWith('play');
	});

	it('shows the asked-for state at once, before the real one arrives', async () => {
		const { controller, setTab } = setup({ now: nowPlaying, tab: tab('playing') });
		await settle();
		expect(controller.get().playing).toBe(true);
		controller.togglePlayPause();
		expect(controller.get().playing).toBe(false);
		// The real state arrives and replaces it.
		setTab(tab('paused'));
		expect(controller.get().playing).toBe(false);
		setTab(tab('playing'));
		expect(controller.get().playing).toBe(true);
	});

	it('goes back to the real state if the command fails', async () => {
		const { controller, command } = setup({ now: nowPlaying, tab: tab('playing') });
		command.mockResolvedValue({ ok: false, error: 'failed' });
		await settle();
		controller.togglePlayPause();
		await settle();
		expect(controller.get().playing).toBe(true);
	});

	it('goes back to the real state if it never arrives', async () => {
		vi.useFakeTimers();
		const { controller } = setup({ now: nowPlaying, tab: tab('playing') });
		await vi.advanceTimersByTimeAsync(0);
		controller.togglePlayPause();
		expect(controller.get().playing).toBe(false);
		await vi.advanceTimersByTimeAsync(OPTIMISTIC_MS + 10);
		expect(controller.get().playing).toBe(true);
		vi.useRealTimers();
	});

	it('sends go-to-video', async () => {
		const { controller, command } = setup({ now: nowPlaying, tab: tab('playing') });
		await settle();
		controller.goToVideo();
		expect(command).toHaveBeenCalledWith('go-to-video');
	});

	it('sends nothing when there is no playback tab', async () => {
		const { controller, command } = setup({ now: nowPlaying });
		await settle();
		controller.togglePlayPause();
		controller.goToVideo();
		for (const sent of ['play', 'pause', 'go-to-video', 'resume'] as const) {
			expect(command).not.toHaveBeenCalledWith(sent);
		}
	});

	it('shows a change made after it started', async () => {
		const { controller, setNow } = setup();
		await settle();
		const seen: (string | null)[] = [];
		controller.subscribe((v) => seen.push(v.video?.videoId ?? null));
		setNow(nowPlaying);
		setNow(null);
		expect(seen).toEqual([null, 'aqz-KE-bpKQ', null]);
	});

	it('shows the video paused with Resume when there is no playback tab', async () => {
		const { controller, command } = setup({ now: { ...nowPlaying, positionSec: 750 } });
		await settle();
		expect(controller.get()).toMatchObject({ canResume: true, canControl: false, playing: false });
		expect(controller.get().video?.positionText).toBe('12:30');
		controller.resume();
		expect(command).toHaveBeenCalledWith('resume');
	});

	it('does not offer Resume while there is a playback tab', async () => {
		const { controller, command } = setup({ now: nowPlaying, tab: tab('paused') });
		await settle();
		expect(controller.get().canResume).toBe(false);
		controller.resume();
		expect(command).not.toHaveBeenCalledWith('resume');
	});

	it('says it is waiting when a resumed tab has not started after 10 seconds', async () => {
		vi.useFakeTimers();
		const { controller, setTab, setResume, now, advance } = setup({ now: nowPlaying });
		await vi.advanceTimersByTimeAsync(0);
		setTab(tab('paused'));
		setResume({ tabId: 3, startedAt: now() });
		expect(controller.get().waitingToStart).toBe(false);
		advance(10_000);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(controller.get().waitingToStart).toBe(true);
		setTab(tab('playing'));
		expect(controller.get().waitingToStart).toBe(false);
		vi.useRealTimers();
	});

	it('is not waiting for a resume that belongs to another tab', async () => {
		const { controller, setTab, setResume, now, advance } = setup({ now: nowPlaying });
		await settle();
		setTab(tab('paused'));
		setResume({ tabId: 99, startedAt: now() - 60_000 });
		advance(0);
		expect(controller.get().waitingToStart).toBe(false);
	});

	it('asks the background to check the tab when it opens and every 15 seconds', async () => {
		vi.useFakeTimers();
		const { command } = setup({ now: nowPlaying, tab: tab('playing') });
		await vi.advanceTimersByTimeAsync(0);
		expect(command).toHaveBeenCalledWith('check');
		command.mockClear();
		await vi.advanceTimersByTimeAsync(15_000);
		expect(command).toHaveBeenCalledWith('check');
		vi.useRealTimers();
	});

	it('counts the position forward every second while playing, and stops when paused', async () => {
		vi.useFakeTimers();
		const { controller, setTab, advance, now } = setup({
			now: nowPlaying,
			tab: { ...tab('playing'), stateAt: 1_000_000, positionSec: 100 }
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(controller.get().progress?.elapsedSec).toBe(100);
		advance(1000);
		await vi.advanceTimersByTimeAsync(1000);
		expect(controller.get().progress?.elapsedSec).toBe(101);
		advance(1000);
		await vi.advanceTimersByTimeAsync(1000);
		expect(controller.get().progress?.elapsedSec).toBe(102);

		setTab({ ...tab('paused'), stateAt: now(), positionSec: 102.4 });
		advance(5000);
		await vi.advanceTimersByTimeAsync(5000);
		expect(controller.get().progress?.elapsedSec).toBe(102);
		vi.useRealTimers();
	});

	it('shows no progress without a video', async () => {
		const { controller } = setup();
		await settle();
		expect(controller.get().progress).toBeNull();
	});

	it('stops listening when disposed', () => {
		const { controller, stop } = setup();
		controller.dispose();
		expect(stop).toHaveBeenCalledTimes(3);
	});
});
