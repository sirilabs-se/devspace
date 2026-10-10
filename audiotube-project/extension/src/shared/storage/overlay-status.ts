export type OverlayStatus = 'failed' | 'ok';

const KEY_PREFIX = 'overlayStatus:';

/** The key under which the background keeps one tab's status in session storage. */
export function overlayStatusKey(tabId: number): string {
	return `${KEY_PREFIX}${tabId}`;
}

function tabIdFromKey(key: string): number | null {
	if (!key.startsWith(KEY_PREFIX)) return null;
	const id = Number(key.slice(KEY_PREFIX.length));
	return Number.isInteger(id) ? id : null;
}

function toStatuses(items: Record<string, unknown>): Record<number, OverlayStatus> {
	const statuses: Record<number, OverlayStatus> = {};
	for (const [key, value] of Object.entries(items)) {
		const tabId = tabIdFromKey(key);
		if (tabId !== null && value === 'failed') statuses[tabId] = 'failed';
	}
	return statuses;
}

/** Tabs whose overlay could not be applied. A tab that is not listed is fine. */
export async function readOverlayStatuses(): Promise<Record<number, OverlayStatus>> {
	return toStatuses(await chrome.storage.session.get(null));
}

export function watchOverlayStatuses(
	listener: (statuses: Record<number, OverlayStatus>) => void
): () => void {
	let latest = 0;
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'session' || !Object.keys(changes).some((key) => tabIdFromKey(key) !== null))
			return;
		const ticket = ++latest;
		readOverlayStatuses().then(
			(statuses) => {
				if (ticket === latest) listener(statuses);
			},
			() => {}
		);
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
