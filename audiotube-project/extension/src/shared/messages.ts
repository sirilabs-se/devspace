import type { OverlayStatus } from './storage/overlay-status';

export type SettingsError = 'invalid-value' | 'storage-failed' | 'background-unavailable';

export interface SetAudioOnlyRequest {
	type: 'settings/set-audio-only';
	value: boolean;
}

export type SetAudioOnlyResponse =
	{ ok: true; audioOnly: boolean } | { ok: false; error: SettingsError };

export interface OverlayStatusReport {
	type: 'overlay/status';
	status: OverlayStatus;
}

/** Every request any context may send to the background. */
export type BackgroundRequest = SetAudioOnlyRequest | OverlayStatusReport;

export function isBackgroundRequest(message: unknown): message is BackgroundRequest {
	if (typeof message !== 'object' || message === null) return false;
	const { type, status, value } = message as { type?: unknown; status?: unknown; value?: unknown };
	if (type === 'settings/set-audio-only') return value !== undefined;
	return type === 'overlay/status' && (status === 'failed' || status === 'ok');
}

/** Tells the background whether the overlay could be put on this tab's player. */
export async function reportOverlayStatus(status: OverlayStatus): Promise<void> {
	const report: OverlayStatusReport = { type: 'overlay/status', status };
	try {
		await chrome.runtime.sendMessage(report);
	} catch {
		// The extension is gone or restarting; the next report will be sent when it is back.
	}
}

export async function requestSetAudioOnly(value: boolean): Promise<SetAudioOnlyResponse> {
	const request: SetAudioOnlyRequest = { type: 'settings/set-audio-only', value };
	try {
		return (await chrome.runtime.sendMessage(request)) as SetAudioOnlyResponse;
	} catch {
		return { ok: false, error: 'background-unavailable' };
	}
}
