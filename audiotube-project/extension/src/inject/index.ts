import { onMessageToPage, PLAYER_SELECTOR, sendToContent } from '../shared';
import { createQualityManager, type PlayerApi } from './quality';

const GUARD = '__audiotubePageStarted';
const scope = globalThis as unknown as Record<string, boolean>;

const RETRY_MS = 500;
const MAX_RETRIES = 10;

// The script can be injected twice (manifest and on install); only the first copy runs.
if (!scope[GUARD]) {
	scope[GUARD] = true;

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

	onMessageToPage((message) => {
		// The content script repeats the mode when this script starts; the same mode needs no second request.
		if (message.type !== 'quality/set' || message.mode === mode) return;
		mode = message.mode;
		sync();
	});

	// A new video may have a new set of levels; ask again once it has loaded.
	document.addEventListener('yt-navigate-finish', () => mode === 'lowest' && sync());

	sendToContent({ type: 'quality/ready' });
}
