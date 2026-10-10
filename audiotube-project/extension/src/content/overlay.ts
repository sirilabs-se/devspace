import overlayCss from './overlay.css?inline';

const HEADPHONES =
	'M12 3a9 9 0 00-9 9v7a2 2 0 002 2h4v-8H5v-1a7 7 0 0114 0v1h-4v8h4a2 2 0 002-2v-7a9 9 0 00-9-9z';

export interface Overlay {
	readonly host: HTMLElement;
	destroy(): void;
}

/** The plain cover, placed inside the player element so it resizes and moves with it. */
export function createOverlay(player: HTMLElement, onShowVideo: () => void): Overlay {
	const host = document.createElement('audiotube-overlay');
	const root = host.attachShadow({ mode: 'open' });

	const sheet = new CSSStyleSheet();
	sheet.replaceSync(overlayCss);
	root.adoptedStyleSheets = [sheet];

	const cover = document.createElement('div');
	cover.className = 'cover';

	const logo = document.createElement('span');
	logo.className = 'logo';
	logo.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="${HEADPHONES}"/></svg>`;

	const label = document.createElement('span');
	label.className = 'label';
	label.textContent = 'Audio only';

	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = 'Show video';
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		onShowVideo();
	});

	cover.append(logo, label, button);
	root.append(cover);
	player.append(host);

	return { host, destroy: () => host.remove() };
}
