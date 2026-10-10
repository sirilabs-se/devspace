export type SettingsError = 'invalid-value' | 'storage-failed' | 'background-unavailable';

export interface SetAudioOnlyRequest {
	type: 'settings/set-audio-only';
	value: boolean;
}

export type SetAudioOnlyResponse =
	{ ok: true; audioOnly: boolean } | { ok: false; error: SettingsError };

/** Every request any context may send to the background. */
export type BackgroundRequest = SetAudioOnlyRequest;

export function isBackgroundRequest(message: unknown): message is BackgroundRequest {
	return (
		typeof message === 'object' &&
		message !== null &&
		(message as { type?: unknown }).type === 'settings/set-audio-only'
	);
}

export async function requestSetAudioOnly(value: boolean): Promise<SetAudioOnlyResponse> {
	const request: SetAudioOnlyRequest = { type: 'settings/set-audio-only', value };
	try {
		return (await chrome.runtime.sendMessage(request)) as SetAudioOnlyResponse;
	} catch {
		return { ok: false, error: 'background-unavailable' };
	}
}
