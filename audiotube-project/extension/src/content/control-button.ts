import controlCss from './control-button.css?inline';

const HEADPHONES =
	'M12 3a9 9 0 00-9 9v7a2 2 0 002 2h4v-8H5v-1a7 7 0 0114 0v1h-4v8h4a2 2 0 002-2v-7a9 9 0 00-9-9z';

export interface ControlButton {
	readonly host: HTMLElement;
	destroy(): void;
}

/** YouTube's control bar, where the button goes. The newer layout groups the right-hand buttons. */
export function findControlBar(player: HTMLElement): HTMLElement | null {
	return (
		player.querySelector<HTMLElement>('.ytp-right-controls-left') ??
		player.querySelector<HTMLElement>('.ytp-right-controls')
	);
}

export function createControlButton(bar: HTMLElement, onPress: () => void): ControlButton {
	const host = document.createElement('audiotube-control');
	const root = host.attachShadow({ mode: 'open' });

	const sheet = new CSSStyleSheet();
	sheet.replaceSync(controlCss);
	root.adoptedStyleSheets = [sheet];

	const button = document.createElement('button');
	button.type = 'button';
	button.title = 'Audio only';
	button.setAttribute('aria-label', 'Audio only');
	button.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="${HEADPHONES}"/></svg>`;
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		onPress();
	});

	root.append(button);
	bar.prepend(host);

	return { host, destroy: () => host.remove() };
}
