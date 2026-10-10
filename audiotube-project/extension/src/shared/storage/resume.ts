export const RESUME_KEY = 'resume';

/** A Resume that opened a tab and is waiting for it to start playing. Kept in session storage. */
export interface PendingResume {
	tabId: number;
	/** Epoch milliseconds. */
	startedAt: number;
}

const wholeNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

export function parsePendingResume(raw: unknown): PendingResume | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const v = raw as Record<string, unknown>;
	const tabId = wholeNumber(v.tabId);
	const startedAt = wholeNumber(v.startedAt);
	return tabId === null || startedAt === null ? null : { tabId, startedAt };
}

export async function readPendingResume(): Promise<PendingResume | null> {
	const items = await chrome.storage.session.get(RESUME_KEY);
	return parsePendingResume(items[RESUME_KEY]);
}

export function watchPendingResume(listener: (resume: PendingResume | null) => void): () => void {
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'session' || !(RESUME_KEY in changes)) return;
		readPendingResume().then(listener, () => {});
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
