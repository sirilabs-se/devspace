import { isBackgroundRequest } from '../shared';
import { handlePlayerReport } from './playback';
import { recordOverlayStatus } from './overlay-status';
import { setAudioOnly } from './settings-store';

/** Must be called synchronously when the service worker starts, so no message is missed after a restart. */
export function listenForRequests(): void {
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (sender.id !== chrome.runtime.id || !isBackgroundRequest(message)) return false;

		if (message.type === 'settings/set-audio-only') {
			void setAudioOnly(message.value).then((response) => sendResponse(response));
			return true;
		}

		const tabId = sender.tab?.id;
		if (tabId === undefined) return false;

		if (message.type !== 'overlay/status') {
			// A report about a tab takes the tab from the sender, never from the message.
			const windowId = sender.tab?.windowId ?? -1;
			void handlePlayerReport(message, { tabId, windowId });
			return false;
		}

		recordOverlayStatus(tabId, message.status).then(
			() => sendResponse({ ok: true }),
			() => sendResponse({ ok: false })
		);
		return true;
	});
}
