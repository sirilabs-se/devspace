import { isBackgroundRequest, type SetAudioOnlyResponse } from '../shared';
import { setAudioOnly } from './settings-store';

/** Must be called synchronously when the service worker starts, so no message is missed after a restart. */
export function listenForRequests(): void {
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (sender.id !== chrome.runtime.id || !isBackgroundRequest(message)) return false;
		void setAudioOnly(message.value).then((response: SetAudioOnlyResponse) =>
			sendResponse(response)
		);
		return true;
	});
}
