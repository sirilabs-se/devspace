import type { Settings } from '../shared';

export const VISIBLE_ATTRIBUTE = 'data-audiotube-visible';

export interface VisibilityDeps {
	read: () => Promise<Settings>;
	watch: (listener: (settings: Settings) => void) => () => void;
}

/**
 * The early CSS hides the picture unless <html> carries this attribute. It is set while audio-only is off,
 * so a page that was opened with audio-only on shows the picture again as soon as it is turned off.
 */
export function startVisibilityFlag(deps: VisibilityDeps, root: HTMLElement): () => void {
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
		root.removeAttribute(VISIBLE_ATTRIBUTE);
	};
}
