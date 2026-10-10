import type { Settings } from '../shared';
import { createControlButton, findControlBar, type ControlButton } from './control-button';
import { onPageChange } from './page-changes';
import { findPlayer, isWatchPath } from './watch-page';

export interface ControlButtonControllerDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
	requestAudioOnly: () => Promise<boolean>;
}

/** Shows an Audio only button in YouTube's control bar while the video is shown. If the bar is not found, shows nothing. */
export function startControlButtonController(deps: ControlButtonControllerDeps): () => void {
	let audioOnly: boolean | null = null;
	let button: ControlButton | null = null;
	let buttonBar: HTMLElement | null = null;

	function remove() {
		button?.destroy();
		button = null;
		buttonBar = null;
	}

	function reconcile() {
		try {
			const player =
				audioOnly === false && isWatchPath(location.pathname) ? findPlayer(document) : null;
			const bar = player && findControlBar(player);
			if (!bar) return remove();
			if (button && buttonBar === bar && bar.contains(button.host)) return;
			remove();
			button = createControlButton(bar, deps.requestAudioOnly);
			buttonBar = bar;
		} catch {
			remove();
		}
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
