import {
	findMainPlayer,
	onMessageToPage,
	PLAYER_SELECTOR,
	sendToContent,
	type PlayerVideoDetails,
	type PlayState
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
	getPlaybackRate?: () => unknown;
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

/** Plays or pauses the player; `undefined` toggles, as a click on YouTube's own picture does. */
function setPlayback(wantPlaying?: boolean) {
	const player = document.querySelector(PLAYER_SELECTOR) as unknown as YouTubePlayer | null;
	try {
		if (player?.getPlayerState && player.playVideo && player.pauseVideo) {
			// 1 playing, 3 buffering: both are on their way to being heard.
			const playing = [1, 3].includes(player.getPlayerState() as number);
			const play = wantPlaying ?? !playing;
			if (play && !playing) player.playVideo();
			else if (!play && playing) player.pauseVideo();
			return;
		}
		const video = document.querySelector<HTMLVideoElement>(`${PLAYER_SELECTOR} video`);
		if (!video) return;
		const play = wantPlaying ?? video.paused;
		if (play && video.paused) void video.play().catch(() => {});
		else if (!play && !video.paused) video.pause();
	} catch {
		// The player is YouTube's to control; if it refuses, nothing else should break.
	}
}

/**
 * The play state, taken from the video element where there is one. YouTube's own state can trail the element
 * by a moment, and a hidden tab's timer is throttled, so waiting for the next beat would be slow.
 */
function currentState(player: YouTubePlayer): PlayState {
	const video = (player as unknown as HTMLElement).querySelector?.('video');
	if (video) {
		if (video.ended) return 'ended';
		if (video.paused) return 'paused';
		return video.readyState >= 3 ? 'playing' : 'buffering';
	}
	return playStateFromNumber(player.getPlayerState?.());
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
		const rate = Number(
			(player as unknown as HTMLElement).querySelector?.('video')?.playbackRate ??
				player.getPlaybackRate?.()
		);
		return {
			...details,
			rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
			state: currentState(player),
			// One decimal: the side panel counts forward from this, so a whole second would show as a lag.
			positionSec: Number.isFinite(position) && position > 0 ? Math.round(position * 10) / 10 : 0,
			adPlaying: (player as unknown as HTMLElement).classList?.contains('ad-showing') === true
		};
	} catch {
		return null;
	}
}

const reporter = createReporter({ read: readSnapshot, send: sendToContent, now: () => Date.now() });

const stopListening = onMessageToPage((message) => {
	if (message.type === 'player/toggle-playback') return setPlayback();
	if (message.type === 'player/command') return setPlayback(message.command === 'play');
	if (message.type !== 'quality/set') return;
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

// The video's own events report a pause or play at once. They are listened for on the document, in the
// capture phase (media events do not bubble), so a video element YouTube swaps for another is still heard.
const VIDEO_EVENTS = [
	'play',
	'playing',
	'pause',
	'waiting',
	'ended',
	'loadedmetadata',
	'seeked',
	'ratechange'
];
// A seek and a rate change are reported even if the state is the same: the panel counts from the new place.
const FORCING = ['seeked', 'ratechange'];
const onVideoEvent = (event: Event) => {
	if (event.target instanceof HTMLVideoElement)
		reporter.check({ force: FORCING.includes(event.type) });
};
for (const name of VIDEO_EVENTS) document.addEventListener(name, onVideoEvent, true);

const beat = setInterval(() => reporter.check(), CHECK_EVERY_MS);
reporter.check();

scope[SLOT] = {
	stop() {
		clearTimeout(retry);
		clearInterval(beat);
		stopListening();
		document.removeEventListener('yt-navigate-finish', onNavigate);
		for (const name of VIDEO_EVENTS) document.removeEventListener(name, onVideoEvent, true);
	}
};

sendToContent({ type: 'quality/ready' });
