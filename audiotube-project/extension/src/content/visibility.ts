import type { Settings } from '../shared';

export const VISIBLE_ATTRIBUTE = 'data-audiotube-visible';
/** Which copy of the content script most recently took charge of the flag. */
export const OWNER_ATTRIBUTE = 'data-audiotube-owner';

export interface VisibilityDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
}

/**
 * The early CSS hides the picture unless <html> carries the visible attribute. It is set while audio-only is
 * off, so a page that was opened with audio-only on shows the picture again as soon as it is turned off.
 *
 * Each copy of the script marks <html> with its own `id`. A copy that is cut off from the extension touches
 * the flag only if the mark is still its own, so it never undoes what a newer copy set. A cut-off copy that is
 * still the newest sets the flag, because nothing will take the overlay's place and the picture must show.
 */
export function startVisibilityFlag(
	deps: VisibilityDeps,
	root: HTMLElement,
	id: string
): () => void {
	root.setAttribute(OWNER_ATTRIBUTE, id);
	let known = false;
	const apply = (settings: Settings) => {
		known = true;
		if (settings.audioOnly) root.removeAttribute(VISIBLE_ATTRIBUTE);
		else root.setAttribute(VISIBLE_ATTRIBUTE, '');
	};
	const stop = deps.watch(apply);
	void deps.read().then(
		(settings) => !known && apply(settings),
		() => {}
	);
	return () => {
		stop();
		if (root.getAttribute(OWNER_ATTRIBUTE) !== id) return;
		root.setAttribute(VISIBLE_ATTRIBUTE, '');
		root.removeAttribute(OWNER_ATTRIBUTE);
	};
}
