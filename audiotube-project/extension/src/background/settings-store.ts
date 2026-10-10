import { isValidSettingValue, type SetAudioOnlyResponse } from '../shared';

/** Validates with the shared schema, then writes only the audio-only key, so no other saved value is touched. */
export async function setAudioOnly(value: unknown): Promise<SetAudioOnlyResponse> {
	if (!isValidSettingValue('audioOnly', value)) return { ok: false, error: 'invalid-value' };
	try {
		await chrome.storage.local.set({ audioOnly: value });
	} catch {
		return { ok: false, error: 'storage-failed' };
	}
	return { ok: true, audioOnly: value };
}
