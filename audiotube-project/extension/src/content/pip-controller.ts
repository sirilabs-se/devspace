import type { Settings } from '../shared';
import { PLAYER_SELECTOR } from '../shared';
import { onPageChange } from './page-changes';

export interface PipControllerDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
}

/** While audio-only is on the video cannot go into picture-in-picture; an open window is closed. */
export function startPipController(deps: PipControllerDeps): () => void {
	let audioOnly: boolean | null = null;
	// What each video had before this extension turned picture-in-picture off on it.
	const original = new WeakMap<HTMLVideoElement, boolean>();
	const changed = new Set<HTMLVideoElement>();

	function reconcile() {
		if (audioOnly === null) return;
		if (audioOnly) {
			for (const video of document.querySelectorAll<HTMLVideoElement>(`${PLAYER_SELECTOR} video`)) {
				if (!original.has(video)) original.set(video, video.disablePictureInPicture);
				// Only when it differs: setting the same value still counts as a change and would loop.
				if (!video.disablePictureInPicture) video.disablePictureInPicture = true;
				changed.add(video);
			}
			if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
		} else {
			for (const video of changed) {
				const wanted = original.get(video) ?? false;
				if (video.disablePictureInPicture !== wanted) video.disablePictureInPicture = wanted;
			}
			changed.clear();
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
	// YouTube may switch it back on a video it already has; put it right again.
	const attributes = new MutationObserver(reconcile);
	attributes.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['disablepictureinpicture'],
		subtree: true
	});

	return () => {
		stopWatching();
		stopObserving();
		attributes.disconnect();
		audioOnly = false;
		reconcile();
	};
}
