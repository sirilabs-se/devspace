const SCRIPT_ID = 'audiotube-early-css';
const EARLY_CSS = 'early.css';

async function isRegistered(): Promise<boolean> {
	const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
	return scripts.length > 0;
}

/**
 * While audio-only is on, a CSS-only content script runs at document_start on YouTube pages, so the picture
 * is hidden before the first paint. Registered while on, removed when off.
 */
export async function syncEarlyCss(audioOnly: boolean): Promise<void> {
	const registered = await isRegistered();
	if (audioOnly && !registered) {
		await chrome.scripting.registerContentScripts([
			{
				id: SCRIPT_ID,
				matches: ['https://www.youtube.com/*'],
				css: [EARLY_CSS],
				runAt: 'document_start',
				persistAcrossSessions: true
			}
		]);
	} else if (!audioOnly && registered) {
		await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
	}
}

/** Keeps the early CSS in step with the saved value; changes are applied one after another. */
export function keepEarlyCssInStep(
	read: () => Promise<{ audioOnly: boolean }>,
	watch: (listener: (settings: { audioOnly: boolean }) => void) => () => void
): () => void {
	let queue: Promise<void> = Promise.resolve();
	const apply = (audioOnly: boolean) => {
		queue = queue.then(() => syncEarlyCss(audioOnly)).catch(() => {});
	};
	const stop = watch((settings) => apply(settings.audioOnly));
	read().then(
		(settings) => apply(settings.audioOnly),
		() => {}
	);
	return stop;
}
