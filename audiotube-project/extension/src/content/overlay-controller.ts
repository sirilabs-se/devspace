import type { Settings } from '../shared';
import { createOverlay, type Overlay } from './overlay';
import { onPageChange } from './page-changes';
import { findPlayer, isWatchPath } from './watch-page';

export interface OverlayControllerDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	requestShowVideo: () => Promise<boolean>;
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

	function reconcile() {
		const player = audioOnly && isWatchPath(location.pathname) ? findPlayer(document) : null;
		if (!player) return remove();
		if (overlay && overlayPlayer === player && player.contains(overlay.host)) return;
		remove();
		overlay = createOverlay(player, deps.requestShowVideo);
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
		remove();
	};
}
