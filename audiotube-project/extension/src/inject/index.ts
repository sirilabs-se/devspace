import { onMessageToPage, PLAYER_SELECTOR, sendToContent } from '../shared';
import { createQualityManager, type PlayerApi } from './quality';

const SLOT = '__audiotubePage';
const scope = globalThis as unknown as Record<string, { stop(): void } | undefined>;

const RETRY_MS = 500;
const MAX_RETRIES = 10;

// A copy left from before an update (or injected twice) is stopped, so the newest copy is the only one.
scope[SLOT]?.stop();

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
	const player = document.querySelector(PLAYER_SELECTOR) as unknown as {
		getPlayerState?: () => number;
		playVideo?: () => void;
		pauseVideo?: () => void;
	} | null;
	try {
		if (player?.getPlayerState && player.playVideo && player.pauseVideo) {
			// 1 playing, 3 buffering: both are on their way to being heard.
			const playing = [1, 3].includes(player.getPlayerState());
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

const stopListening = onMessageToPage((message) => {
	if (message.type === 'player/toggle-playback') return togglePlayback();
	// The content script repeats the mode when this script starts; the same mode needs no second request.
	if (message.mode === mode) return;
	mode = message.mode;
	sync();
});

// A new video may have a new set of levels; ask again once it has loaded.
const onNavigate = () => mode === 'lowest' && sync();
document.addEventListener('yt-navigate-finish', onNavigate);

scope[SLOT] = {
	stop() {
		clearTimeout(retry);
		stopListening();
		document.removeEventListener('yt-navigate-finish', onNavigate);
	}
};

sendToContent({ type: 'quality/ready' });
