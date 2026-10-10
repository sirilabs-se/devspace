import type { ContentToPage, Settings } from '../shared';

export interface QualityControllerDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	send: (message: ContentToPage) => void;
	onPageReady: (handler: () => void) => () => void;
}

/** Tells the page script whether to request the lowest quality: audio-only and Save bandwidth both on. */
export function startQualityController(deps: QualityControllerDeps): () => void {
	let mode: ContentToPage['mode'] | null = null;
	let known = false;

	function apply(settings: Settings) {
		known = true;
		const next = settings.audioOnly && settings.saveBandwidth ? 'lowest' : 'normal';
		if (next === mode) return;
		mode = next;
		deps.send({ type: 'quality/set', mode });
	}

	const stopWatching = deps.watch(apply);
	void deps.read().then(
		(settings) => !known && apply(settings),
		() => {}
	);
	// The page script may start after this one, and a restarted page script has forgotten the mode.
	const stopReady = deps.onPageReady(() => mode && deps.send({ type: 'quality/set', mode }));

	return () => {
		stopWatching();
		stopReady();
	};
}
