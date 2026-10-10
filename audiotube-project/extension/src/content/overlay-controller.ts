import type { Settings } from '../shared';
import { createOverlay, type Overlay } from './overlay';
import { onPageChange } from './page-changes';
import { findPlayer, findPlayerToCover } from './watch-page';

export interface OverlayControllerDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	requestShowVideo: () => Promise<boolean>;
	togglePlayback: () => void;
}

/** Keeps the overlay present exactly when audio-only is on and a watch-page player is present. */
export function startOverlayController(deps: OverlayControllerDeps): () => void {
	let audioOnly: boolean | null = null;
	let overlay: Overlay | null = null;
	let overlayPlayer: HTMLElement | null = null;

	function remove() {
		overlay?.destroy();
		overlay = null;
		overlayPlayer = null;
	}

	// The mini-player opens, closes and moves without the page changing, so the player's size is watched too.
	const resizes = new ResizeObserver(() => reconcile());
	let observed: HTMLElement | null = null;

	function reconcile() {
		const current = findPlayer(document);
		if (current !== observed) {
			resizes.disconnect();
			observed = current;
			if (current) resizes.observe(current);
		}
		const player = audioOnly ? findPlayerToCover(document, location.pathname) : null;
		if (!player) return remove();
		if (overlay && overlayPlayer === player && player.contains(overlay.host)) return;
		remove();
		overlay = createOverlay(player, deps.requestShowVideo, deps.togglePlayback);
		overlayPlayer = player;
	}

	const apply = (settings: Settings) => {
		audioOnly = settings.audioOnly;
		reconcile();
	};

	const stopWatching = deps.watch(apply);
	void deps.read().then(
		(settings) => audioOnly === null && apply(settings),
		() => {}
	);

	const stopObserving = onPageChange(reconcile);

	return () => {
		stopWatching();
		stopObserving();
		resizes.disconnect();
		remove();
	};
}
