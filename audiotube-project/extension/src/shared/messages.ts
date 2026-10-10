import type { PlayerReport } from './page-messages';
import type { OverlayStatus } from './storage/overlay-status';
import { isVideoId } from './storage/now-playing';
import { isPlayState } from './storage/playback-tab';

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
export type BackgroundRequest = SetAudioOnlyRequest | OverlayStatusReport | PlayerReport;

const MAX_RAW_TEXT = 2000;
const MAX_SECONDS = 10_000_000;

const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= MAX_RAW_TEXT;
const isSeconds = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_SECONDS;

/** Checks the shape of a player report. The page can forge messages, so the content script checks before forwarding. */
export function isPlayerReport(message: unknown): message is PlayerReport {
	if (typeof message !== 'object' || message === null) return false;
	const m = message as Record<string, unknown>;
	switch (m.type) {
		case 'player/video':
			return (
				isVideoId(m.videoId) &&
				isText(m.title) &&
				isText(m.channel) &&
				(m.durationSec === null || isSeconds(m.durationSec)) &&
				typeof m.isLive === 'boolean'
			);
		case 'player/state':
			return isPlayState(m.state) && isSeconds(m.positionSec);
		case 'player/position':
			return isSeconds(m.positionSec);
		default:
			return false;
	}
}

export function isBackgroundRequest(message: unknown): message is BackgroundRequest {
	if (typeof message !== 'object' || message === null) return false;
	const { type, status, value } = message as { type?: unknown; status?: unknown; value?: unknown };
	if (type === 'settings/set-audio-only') return value !== undefined;
	if (type === 'overlay/status') return status === 'failed' || status === 'ok';
	return isPlayerReport(message);
}

/** Passes a checked player report on to the background. The tab is taken from the sender there. */
export async function reportPlayer(report: PlayerReport): Promise<void> {
	try {
		await chrome.runtime.sendMessage(report);
	} catch {
		// The extension is gone or restarting; the next report will carry the state.
	}
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
