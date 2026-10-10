import type { OverlayStatus, Settings } from '../shared';

export interface CoverStatusDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	/** True on a page where the overlay is expected, with audio-only on or not. */
	onWatchPage: () => boolean;
	playerPresent: () => boolean;
	report: (status: OverlayStatus) => void;
	onPageChange: (callback: () => void) => () => void;
	waitMs?: number;
}

const DEFAULT_WAIT_MS = 5000;

/**
 * Says when audio-only is on, this is a watch page and the player still cannot be found after a short wait,
 * and says again when it can. Nothing here touches playback.
 */
export function startCoverStatusController(deps: CoverStatusDeps): () => void {
	const waitMs = deps.waitMs ?? DEFAULT_WAIT_MS;
	let audioOnly: boolean | null = null;
	let reported: OverlayStatus | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function set(status: OverlayStatus) {
		if (status === reported) return;
		reported = status;
		deps.report(status);
	}

	function stopWaiting() {
		clearTimeout(timer);
		timer = undefined;
	}

	function reconcile() {
		if (audioOnly === null) return;
		const expected = audioOnly && deps.onWatchPage();
		if (!expected || deps.playerPresent()) {
			stopWaiting();
			set('ok');
			return;
		}
		if (timer !== undefined || reported === 'failed') return;
		timer = setTimeout(() => {
			timer = undefined;
			if (audioOnly && deps.onWatchPage() && !deps.playerPresent()) set('failed');
		}, waitMs);
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
	const stopObserving = deps.onPageChange(reconcile);

	return () => {
		stopWatching();
		stopObserving();
		stopWaiting();
	};
}
