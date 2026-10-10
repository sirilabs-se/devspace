import { computeProgress, type Progress } from './progress';
import {
	readNowPlaying,
	readPendingResume,
	readPlaybackTab,
	requestPlayerCommand,
	requestSeek,
	watchNowPlaying,
	watchPendingResume,
	watchPlaybackTab,
	type NowPlaying,
	type PendingResume,
	type PlayerCommandRequest,
	type PlayerCommandResponse,
	type PlaybackTab
} from '../../shared';

export interface NowPlayingVideo {
	videoId: string;
	title: string;
	channel: string;
	/** From YouTube's image server, derived from the video ID. */
	thumbnailUrl: string;
	/** Where it was left, such as 12:30. */
	positionText: string;
}

export interface NowPlayingView {
	/** False until the stored values have been read, so the panel never flashes "Nothing playing". */
	ready: boolean;
	video: NowPlayingVideo | null;
	/** The playback tab's player is playing, or about to. */
	playing: boolean;
	/** There is a playback tab to send play, pause and Go to video to. */
	canControl: boolean;
	/** There is a video but no tab for it: it is shown paused, and Resume opens it again. */
	canResume: boolean;
	/** Resume opened a tab, and it has not started playing after a while. */
	waitingToStart: boolean;
	/** Elapsed and remaining time, counted forward while playing; null with no video. */
	progress: Progress | null;
	/** There is a playback tab, and the video has a length to move around in (not a live stream). */
	canSeek: boolean;
}

export interface NowPlayingController {
	get(): NowPlayingView;
	subscribe(listener: (view: NowPlayingView) => void): () => void;
	/** Pauses if playing, plays if not. */
	togglePlayPause(): void;
	goToVideo(): void;
	resume(): void;
	/** While the bar is dragged: show this position, and stop counting. Nothing is sent to YouTube. */
	previewSeek(positionSec: number): void;
	/** Move YouTube's player to this position. The shown position holds until the real one arrives. */
	commitSeek(positionSec: number): void;
	/** Give up a preview without seeking. */
	cancelSeek(): void;
	dispose(): void;
}

export interface NowPlayingDeps {
	readNowPlaying: () => Promise<NowPlaying | null>;
	watchNowPlaying: (listener: (value: NowPlaying | null) => void) => () => void;
	readPlaybackTab: () => Promise<PlaybackTab | null>;
	watchPlaybackTab: (listener: (value: PlaybackTab | null) => void) => () => void;
	readPendingResume: () => Promise<PendingResume | null>;
	watchPendingResume: (listener: (value: PendingResume | null) => void) => () => void;
	command: (command: PlayerCommandRequest['command']) => Promise<PlayerCommandResponse>;
	seek: (positionSec: number) => Promise<PlayerCommandResponse>;
	now: () => number;
}

const defaultDeps: NowPlayingDeps = {
	readNowPlaying,
	watchNowPlaying,
	readPlaybackTab,
	watchPlaybackTab,
	readPendingResume,
	watchPendingResume,
	command: requestPlayerCommand,
	seek: requestSeek,
	now: () => Date.now()
};

/** How long a position asked for is kept on show while YouTube's real one is on its way. */
export const SEEK_HOLD_MS = 2000;
/** How long the button keeps showing what was asked for while the real state is on its way. */
export const OPTIMISTIC_MS = 4000;
/** How long a resumed tab may take to start before the panel says it is waiting. */
export const WAITING_AFTER_MS = 10_000;
/** How often the position is looked at while playing. */
export const TICK_MS = 250;
/** How often an open panel asks the background to check that the playback tab is still there. */
export const CHECK_EVERY_MS = 15_000;

export function thumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function formatPosition(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	const two = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

export function createNowPlayingController(
	deps: NowPlayingDeps = defaultDeps
): NowPlayingController {
	let nowPlaying: NowPlaying | null = null;
	let playbackTab: PlaybackTab | null = null;
	let pendingResume: PendingResume | null = null;
	let readsDone = 0;
	let view: NowPlayingView = {
		ready: false,
		video: null,
		playing: false,
		canControl: false,
		canResume: false,
		waitingToStart: false,
		progress: null,
		canSeek: false
	};
	let tickTimer: ReturnType<typeof setInterval> | undefined;
	let waitTimer: ReturnType<typeof setTimeout> | undefined;
	// What the user just asked for, shown at once; cleared when the real state arrives or after a while.
	let asked: boolean | null = null;
	let askedTimer: ReturnType<typeof setTimeout> | undefined;
	// A position being dragged to, or just asked for, shown until the real one arrives.
	let shownPosition: number | null = null;
	let seekTimer: ReturnType<typeof setTimeout> | undefined;

	function dropShownPosition() {
		shownPosition = null;
		clearTimeout(seekTimer);
	}

	function clearAsked() {
		asked = null;
		clearTimeout(askedTimer);
	}
	const listeners = new Set<(view: NowPlayingView) => void>();

	function publish() {
		clearTimeout(waitTimer);
		const waiting =
			pendingResume !== null &&
			playbackTab !== null &&
			playbackTab.tabId === pendingResume.tabId &&
			playbackTab.state !== 'playing';
		const elapsed = pendingResume ? deps.now() - pendingResume.startedAt : 0;
		if (waiting && elapsed < WAITING_AFTER_MS) {
			waitTimer = setTimeout(publish, WAITING_AFTER_MS - elapsed);
		}
		const next: NowPlayingView = {
			ready: readsDone >= 3,
			video: nowPlaying && {
				videoId: nowPlaying.videoId,
				title: nowPlaying.title,
				channel: nowPlaying.channel,
				thumbnailUrl: thumbnailUrl(nowPlaying.videoId),
				positionText: formatPosition(nowPlaying.positionSec)
			},
			playing:
				asked ?? (playbackTab !== null && ['playing', 'buffering'].includes(playbackTab.state)),
			canControl: nowPlaying !== null && playbackTab !== null,
			canResume: nowPlaying !== null && playbackTab === null,
			waitingToStart: waiting && elapsed >= WAITING_AFTER_MS,
			progress: nowPlaying
				? computeProgress(
						nowPlaying,
						// A position on show holds still: it is not counted forward.
						shownPosition !== null && playbackTab
							? { ...playbackTab, state: 'paused', positionSec: shownPosition }
							: playbackTab,
						deps.now()
					)
				: null,
			canSeek:
				nowPlaying !== null &&
				playbackTab !== null &&
				!nowPlaying.isLive &&
				nowPlaying.durationSec !== null
		};
		// The time is counted forward while it is moving. Looking four times a second keeps the shown whole
		// second within a quarter of a second of the real one; the view only changes when the second does.
		const moving =
			playbackTab?.state === 'playing' && nowPlaying !== null && shownPosition === null;
		if (moving && tickTimer === undefined) tickTimer = setInterval(publish, TICK_MS);
		if (!moving && tickTimer !== undefined) {
			clearInterval(tickTimer);
			tickTimer = undefined;
		}
		if (JSON.stringify(next) === JSON.stringify(view)) return;
		view = next;
		for (const listener of listeners) listener(view);
	}

	// Watch before reading, so a change made between the two is not missed.
	const stops = [
		deps.watchNowPlaying((value) => {
			nowPlaying = value;
			publish();
		}),
		deps.watchPlaybackTab((value) => {
			playbackTab = value;
			// The real state has arrived; it replaces what was asked for.
			clearAsked();
			dropShownPosition();
			publish();
		}),
		deps.watchPendingResume((value) => {
			pendingResume = value;
			publish();
		})
	];

	const done = () => {
		readsDone++;
		publish();
	};
	deps.readNowPlaying().then((v) => ((nowPlaying = nowPlaying ?? v), done()), done);
	deps.readPlaybackTab().then((v) => ((playbackTab = playbackTab ?? v), done()), done);
	deps.readPendingResume().then((v) => ((pendingResume = pendingResume ?? v), done()), done);

	// A crashed tab raises no event, so an open panel asks the background to look now and then.
	void deps.command('check');
	const checker = setInterval(() => void deps.command('check'), CHECK_EVERY_MS);

	return {
		get: () => view,
		subscribe(listener) {
			listeners.add(listener);
			listener(view);
			return () => listeners.delete(listener);
		},
		togglePlayPause() {
			if (!view.canControl) return;
			const wantPlaying = !view.playing;
			asked = wantPlaying;
			clearTimeout(askedTimer);
			askedTimer = setTimeout(() => {
				asked = null;
				publish();
			}, OPTIMISTIC_MS);
			publish();
			void deps.command(wantPlaying ? 'play' : 'pause').then((response) => {
				if (response.ok) return;
				clearAsked();
				publish();
			});
		},
		goToVideo() {
			if (!view.canControl) return;
			void deps.command('go-to-video');
		},
		resume() {
			if (!view.canResume) return;
			void deps.command('resume');
		},
		previewSeek(positionSec) {
			if (!view.canSeek) return;
			clearTimeout(seekTimer);
			shownPosition = positionSec;
			publish();
		},
		commitSeek(positionSec) {
			if (!view.canSeek) return;
			shownPosition = positionSec;
			clearTimeout(seekTimer);
			seekTimer = setTimeout(() => {
				dropShownPosition();
				publish();
			}, SEEK_HOLD_MS);
			publish();
			void deps.seek(positionSec).then((response) => {
				if (response.ok) return;
				dropShownPosition();
				publish();
			});
		},
		cancelSeek() {
			dropShownPosition();
			publish();
		},
		dispose() {
			clearTimeout(seekTimer);
			for (const stop of stops) stop();
			clearInterval(checker);
			clearInterval(tickTimer);
			clearTimeout(waitTimer);
			clearTimeout(askedTimer);
			listeners.clear();
		}
	};
}
