import overlayCss from './overlay.css?inline';

const HEADPHONES =
	'M12 3a9 9 0 00-9 9v7a2 2 0 002 2h4v-8H5v-1a7 7 0 0114 0v1h-4v8h4a2 2 0 002-2v-7a9 9 0 00-9-9z';

export interface Overlay {
	readonly host: HTMLElement;
	destroy(): void;
}

/** The plain cover, placed inside the player element so it resizes and moves with it. */
const MESSAGE_VISIBLE_MS = 6000;

/** `onShowVideo` resolves to whether the change was saved. */
export function createOverlay(player: HTMLElement, onShowVideo: () => Promise<boolean>): Overlay {
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
	const message = document.createElement('span');
	message.className = 'message';
	message.setAttribute('role', 'alert');
	message.hidden = true;
	message.textContent = "Couldn't change the setting. Try again.";

	let hideMessage: ReturnType<typeof setTimeout> | undefined;
	button.addEventListener('click', async (event) => {
		event.stopPropagation();
		clearTimeout(hideMessage);
		message.hidden = true;
		if (await onShowVideo()) return;
		message.hidden = false;
		hideMessage = setTimeout(() => (message.hidden = true), MESSAGE_VISIBLE_MS);
	});

	cover.append(logo, label, button, message);
	root.append(cover);
	player.append(host);

	return {
		host,
		destroy() {
			clearTimeout(hideMessage);
			host.remove();
		}
	};
}
