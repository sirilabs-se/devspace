import {
	readNowPlaying,
	readPlaybackTab,
	requestPlayerCommand,
	watchNowPlaying,
	watchPlaybackTab,
	type NowPlaying,
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
}

export interface NowPlayingView {
	/** False until the stored values have been read, so the panel never flashes "Nothing playing". */
	ready: boolean;
	video: NowPlayingVideo | null;
	/** The playback tab's player is playing, or about to. */
	playing: boolean;
	/** There is a playback tab to send play, pause and Go to video to. */
	canControl: boolean;
}

export interface NowPlayingController {
	get(): NowPlayingView;
	subscribe(listener: (view: NowPlayingView) => void): () => void;
	/** Pauses if playing, plays if not. */
	togglePlayPause(): void;
	goToVideo(): void;
	dispose(): void;
}

export interface NowPlayingDeps {
	readNowPlaying: () => Promise<NowPlaying | null>;
	watchNowPlaying: (listener: (value: NowPlaying | null) => void) => () => void;
	readPlaybackTab: () => Promise<PlaybackTab | null>;
	watchPlaybackTab: (listener: (value: PlaybackTab | null) => void) => () => void;
	command: (command: PlayerCommandRequest['command']) => Promise<PlayerCommandResponse>;
}

const defaultDeps: NowPlayingDeps = {
	readNowPlaying,
	watchNowPlaying,
	readPlaybackTab,
	watchPlaybackTab,
	command: requestPlayerCommand
};

export function thumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function createNowPlayingController(
	deps: NowPlayingDeps = defaultDeps
): NowPlayingController {
	let nowPlaying: NowPlaying | null = null;
	let playbackTab: PlaybackTab | null = null;
	let readsDone = 0;
	let view: NowPlayingView = { ready: false, video: null, playing: false, canControl: false };
	const listeners = new Set<(view: NowPlayingView) => void>();

	function publish() {
		const next: NowPlayingView = {
			ready: readsDone >= 2,
			video: nowPlaying && {
				videoId: nowPlaying.videoId,
				title: nowPlaying.title,
				channel: nowPlaying.channel,
				thumbnailUrl: thumbnailUrl(nowPlaying.videoId)
			},
			playing: playbackTab !== null && ['playing', 'buffering'].includes(playbackTab.state),
			canControl: nowPlaying !== null && playbackTab !== null
		};
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
			publish();
		})
	];

	deps.readNowPlaying().then(
		(value) => {
			nowPlaying = nowPlaying ?? value;
			readsDone++;
			publish();
		},
		() => {
			readsDone++;
			publish();
		}
	);
	deps.readPlaybackTab().then(
		(value) => {
			playbackTab = playbackTab ?? value;
			readsDone++;
			publish();
		},
		() => {
			readsDone++;
			publish();
		}
	);

	return {
		get: () => view,
		subscribe(listener) {
			listeners.add(listener);
			listener(view);
			return () => listeners.delete(listener);
		},
		togglePlayPause() {
			if (!view.canControl) return;
			void deps.command(view.playing ? 'pause' : 'play');
		},
		goToVideo() {
			if (!view.canControl) return;
			void deps.command('go-to-video');
		},
		dispose() {
			for (const stop of stops) stop();
			listeners.clear();
		}
	};
}
