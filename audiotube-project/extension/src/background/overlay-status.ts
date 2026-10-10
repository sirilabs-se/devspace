import { overlayStatusKey, type OverlayStatus } from '../shared';

/** Keeps the latest status for a tab in session storage, since the service worker can restart at any time. */
export async function recordOverlayStatus(tabId: number, status: OverlayStatus): Promise<void> {
	if (status === 'failed')
		await chrome.storage.session.set({ [overlayStatusKey(tabId)]: 'failed' });
	else await chrome.storage.session.remove(overlayStatusKey(tabId));
}

/** A closed tab, and a tab that is loading a new page, no longer has a status. */
export function forgetStatusesOfGoneTabs(): void {
	const forget = (tabId: number) => void chrome.storage.session.remove(overlayStatusKey(tabId));
	chrome.tabs.onRemoved.addListener(forget);
	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.status === 'loading') forget(tabId);
	});
}
