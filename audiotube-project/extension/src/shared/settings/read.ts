import { parseSettings, SETTING_KEYS, type Settings } from './schema';

/** Rejects if the browser's storage cannot be read; callers decide how to show that. */
export async function readSettings(): Promise<Settings> {
	const raw = await chrome.storage.local.get([...SETTING_KEYS]);
	return parseSettings(raw);
}

/** Calls `listener` with the full, current settings each time a saved value changes. Returns a function that stops listening. */
export function watchSettings(listener: (settings: Settings) => void): () => void {
	let latest = 0;
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'local' || !SETTING_KEYS.some((key) => key in changes)) return;
		const ticket = ++latest;
		readSettings().then(
			(settings) => {
				if (ticket === latest) listener(settings);
			},
			() => {}
		);
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
