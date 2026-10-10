import { describe, expect, it, vi } from 'vitest';
import type { NowPlaying, PlaybackTab } from '../../shared';
import { createNowPlayingController, thumbnailUrl, type NowPlayingDeps } from './now-playing';

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
	stateAt: 1
});

function setup(initial: { now?: NowPlaying | null; tab?: PlaybackTab | null } = {}) {
	let watchNow!: (v: NowPlaying | null) => void;
	let watchTab!: (v: PlaybackTab | null) => void;
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
		command
	});
	return {
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
			canControl: false
		});
	});

	it('shows the video with a thumbnail derived from its id', async () => {
		const { controller } = setup({ now: nowPlaying, tab: tab('paused') });
		await settle();
		expect(controller.get().video).toEqual({
			videoId: 'aqz-KE-bpKQ',
			title: 'Big Buck Bunny',
			channel: 'Blender',
			thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg'
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
		expect(command).not.toHaveBeenCalled();
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

	it('stops listening when disposed', () => {
		const { controller, stop } = setup();
		controller.dispose();
		expect(stop).toHaveBeenCalledTimes(2);
	});
});
