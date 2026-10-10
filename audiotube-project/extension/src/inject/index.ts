import {
	findMainPlayer,
	onMessageToPage,
	PLAYER_SELECTOR,
	sendToContent,
	type PlayerVideoDetails
} from '../shared';
import { createQualityManager, type PlayerApi } from './quality';
import { createReporter, playStateFromNumber, type PlayerSnapshot } from './reporter';

const SLOT = '__audiotubePage';
const scope = globalThis as unknown as Record<string, { stop(): void } | undefined>;

const RETRY_MS = 500;
const MAX_RETRIES = 10;
const CHECK_EVERY_MS = 1000;

/** The player methods this script uses; every one may be missing or throw. */
interface YouTubePlayer extends PlayerApi {
	getVideoData?: () => { video_id?: unknown; title?: unknown; author?: unknown; isLive?: unknown };
	getDuration?: () => unknown;
	getCurrentTime?: () => unknown;
	getPlayerState?: () => unknown;
	playVideo?: () => void;
	pauseVideo?: () => void;
}

// A copy left from before an update (or injected twice) is stopped, so the newest copy is the only one.
scope[SLOT]?.stop();

const mainPlayer = () => findMainPlayer(document, location.pathname) as YouTubePlayer | null;

const quality = createQualityManager({
	player: () => document.querySelector(PLAYER_SELECTOR) as unknown as PlayerApi | null,
	store: localStorage
});

let mode: 'lowest' | 'normal' | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;

function sync(attempt = 0) {
	clearTimeout(retry);
	const outcome = mode === 'lowest' ? quality.applyLowest() : quality.restore();
	if (outcome === 'unavailable' && attempt < MAX_RETRIES) {
		retry = setTimeout(() => sync(attempt + 1), RETRY_MS);
	}
}

/** Pauses a playing video and plays a paused one, as a click on YouTube's own picture does. */
function togglePlayback() {
	const player = document.querySelector(PLAYER_SELECTOR) as unknown as YouTubePlayer | null;
	try {
		if (player?.getPlayerState && player.playVideo && player.pauseVideo) {
			// 1 playing, 3 buffering: both are on their way to being heard.
			const playing = [1, 3].includes(player.getPlayerState() as number);
			if (playing) player.pauseVideo();
			else player.playVideo();
			return;
		}
		const video = document.querySelector<HTMLVideoElement>(`${PLAYER_SELECTOR} video`);
		if (!video) return;
		if (video.paused) void video.play().catch(() => {});
		else video.pause();
	} catch {
		// The player is YouTube's to control; if it refuses, nothing else should break.
	}
}

const textOf = (value: unknown) => (typeof value === 'string' ? value : '');

/** What the main player shows now, or null when there is none or it has not got a video yet. */
function readSnapshot(): PlayerSnapshot | null {
	const player = mainPlayer();
	if (!player) return null;
	try {
		const data = player.getVideoData?.();
		const videoId = textOf(data?.video_id);
		if (!videoId) return null;
		const isLive = data?.isLive === true;
		const duration = Number(player.getDuration?.());
		const position = Number(player.getCurrentTime?.());
		const details: PlayerVideoDetails = {
			videoId,
			title: textOf(data?.title),
			channel: textOf(data?.author),
			durationSec:
				!isLive && Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : null,
			isLive
		};
		return {
			...details,
			state: playStateFromNumber(player.getPlayerState?.()),
			positionSec: Number.isFinite(position) && position > 0 ? Math.floor(position) : 0,
			adPlaying: (player as unknown as HTMLElement).classList?.contains('ad-showing') === true
		};
	} catch {
		return null;
	}
}

const reporter = createReporter({ read: readSnapshot, send: sendToContent, now: () => Date.now() });

const stopListening = onMessageToPage((message) => {
	if (message.type === 'player/toggle-playback') return togglePlayback();
	// The content script repeats the mode when this script starts; the same mode needs no second request.
	if (message.mode === mode) return;
	mode = message.mode;
	sync();
});

// A new video may have a new set of levels; ask again once it has loaded.
const onNavigate = () => {
	if (mode === 'lowest') sync();
	reporter.check();
};
document.addEventListener('yt-navigate-finish', onNavigate);

// The player's own events report a pause or play at once; the beat catches whatever they miss.
const VIDEO_EVENTS = ['play', 'playing', 'pause', 'waiting', 'ended', 'loadedmetadata', 'seeked'];
let watchedVideo: HTMLVideoElement | null = null;
const onVideoEvent = () => reporter.check();
function watchVideo() {
	const video =
		mainPlayer() && document.querySelector<HTMLVideoElement>(`${PLAYER_SELECTOR} video`);
	if (video === watchedVideo) return;
	for (const name of VIDEO_EVENTS) watchedVideo?.removeEventListener(name, onVideoEvent);
	watchedVideo = video || null;
	for (const name of VIDEO_EVENTS) watchedVideo?.addEventListener(name, onVideoEvent);
}

const beat = setInterval(() => {
	watchVideo();
	reporter.check();
}, CHECK_EVERY_MS);
watchVideo();
reporter.check();

scope[SLOT] = {
	stop() {
		clearTimeout(retry);
		clearInterval(beat);
		stopListening();
		document.removeEventListener('yt-navigate-finish', onNavigate);
		for (const name of VIDEO_EVENTS) watchedVideo?.removeEventListener(name, onVideoEvent);
	}
};

sendToContent({ type: 'quality/ready' });
