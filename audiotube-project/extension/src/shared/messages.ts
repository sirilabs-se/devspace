import type { PlayCommand, PlayerReport } from './page-messages';
import type { OverlayStatus } from './storage/overlay-status';
import { isVideoId } from './storage/now-playing';
import { isPlayState } from './storage/playback-tab';
import { isVolumeLevel } from './storage/volume';

export type SettingsError = 'invalid-value' | 'storage-failed' | 'background-unavailable';

export interface SetAudioOnlyRequest {
	type: 'settings/set-audio-only';
	value: boolean;
}

export type SetAudioOnlyResponse =
	{ ok: true; audioOnly: boolean } | { ok: false; error: SettingsError };

/** Side panel → background: move the playback tab's player to this position. */
export interface PlayerSeekRequest {
	type: 'player/seek';
	positionSec: number;
}

/** Side panel → background: remember this volume, and apply it to the playback tab if there is one. */
export interface SetVolumeRequest {
	type: 'player/set-volume';
	level: number;
	muted: boolean;
}

/** Side panel → background: do this with the playback tab. */
export interface PlayerCommandRequest {
	type: 'player/command';
	command: 'play' | 'pause' | 'go-to-video' | 'resume' | 'check';
}

export type PlayerCommandError = 'no-playback-tab' | 'nothing-to-resume' | 'failed';

export type PlayerCommandResponse = { ok: true } | { ok: false; error: PlayerCommandError };

export interface OverlayStatusReport {
	type: 'overlay/status';
	status: OverlayStatus;
}

/** Every request any context may send to the background. */
export type BackgroundRequest =
	| SetAudioOnlyRequest
	| OverlayStatusReport
	| PlayerCommandRequest
	| PlayerSeekRequest
	| SetVolumeRequest
	| PlayerReport;

const MAX_RAW_TEXT = 2000;
const MAX_SECONDS = 10_000_000;

const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= MAX_RAW_TEXT;
const isSeconds = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_SECONDS;

const isRate = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 16;

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
			return isPlayState(m.state) && isSeconds(m.positionSec) && isRate(m.rate);
		case 'player/position':
		case 'player/gone':
			return isSeconds(m.positionSec);
		case 'player/volume':
			return isVolumeLevel(m.level) && typeof m.muted === 'boolean';
		default:
			return false;
	}
}

export function isBackgroundRequest(message: unknown): message is BackgroundRequest {
	if (typeof message !== 'object' || message === null) return false;
	const { type, status, value } = message as { type?: unknown; status?: unknown; value?: unknown };
	if (type === 'settings/set-audio-only') return value !== undefined;
	if (type === 'overlay/status') return status === 'failed' || status === 'ok';
	if (type === 'player/command') return isPlayerCommandRequest(message);
	if (type === 'player/seek') return isSeconds((message as { positionSec?: unknown }).positionSec);
	if (type === 'player/set-volume') {
		const { level, muted } = message as { level?: unknown; muted?: unknown };
		return isVolumeLevel(level) && typeof muted === 'boolean';
	}
	return isPlayerReport(message);
}

function isPlayerCommandRequest(message: unknown): message is PlayerCommandRequest {
	const command = (message as { command?: unknown }).command;
	return (
		command === 'play' ||
		command === 'pause' ||
		command === 'go-to-video' ||
		command === 'resume' ||
		command === 'check'
	);
}

/** Asks the background to remember a volume and apply it to the playback tab. */
export async function requestSetVolume(
	level: number,
	muted: boolean
): Promise<PlayerCommandResponse> {
	const request: SetVolumeRequest = { type: 'player/set-volume', level, muted };
	try {
		return (await chrome.runtime.sendMessage(request)) as PlayerCommandResponse;
	} catch {
		return { ok: false, error: 'failed' };
	}
}

/** Asks the background to seek the playback tab's player. */
export async function requestSeek(positionSec: number): Promise<PlayerCommandResponse> {
	const request: PlayerSeekRequest = { type: 'player/seek', positionSec };
	try {
		return (await chrome.runtime.sendMessage(request)) as PlayerCommandResponse;
	} catch {
		return { ok: false, error: 'failed' };
	}
}

/** Asks the background to act on the playback tab. */
export async function requestPlayerCommand(
	command: PlayerCommandRequest['command']
): Promise<PlayerCommandResponse> {
	const request: PlayerCommandRequest = { type: 'player/command', command };
	try {
		return (await chrome.runtime.sendMessage(request)) as PlayerCommandResponse;
	} catch {
		return { ok: false, error: 'failed' };
	}
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

/** Background → one tab's content script: do this to the tab's player. */
export type TabCommand =
	| { type: 'player/command'; command: PlayCommand }
	| { type: 'player/seek'; positionSec: number }
	| { type: 'player/set-volume'; level: number; muted: boolean };

export function isTabCommand(message: unknown): message is TabCommand {
	if (typeof message !== 'object' || message === null) return false;
	const { type, command, positionSec, level, muted } = message as {
		type?: unknown;
		command?: unknown;
		positionSec?: unknown;
		level?: unknown;
		muted?: unknown;
	};
	if (type === 'player/seek') return isSeconds(positionSec);
	if (type === 'player/set-volume') return isVolumeLevel(level) && typeof muted === 'boolean';
	return type === 'player/command' && (command === 'play' || command === 'pause');
}
