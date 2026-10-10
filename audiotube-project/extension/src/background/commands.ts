import { checkPlaybackTab, resumePlayback } from './playback';
import {
	isVolumeLevel,
	readPlaybackTab,
	VOLUME_KEY,
	type PlayerCommandRequest,
	type PlayerCommandResponse,
	type TabCommand
} from '../shared';

/**
 * Remembers the volume (the side panel is where it is usually changed, and it must be there for the next
 * playback tab even when there is none now) and applies it to the playback tab.
 */
export async function handleSetVolume(
	level: number,
	muted: boolean
): Promise<PlayerCommandResponse> {
	if (!isVolumeLevel(level) || typeof muted !== 'boolean') return { ok: false, error: 'failed' };
	try {
		await chrome.storage.local.set({ [VOLUME_KEY]: { level, muted } });
	} catch {
		return { ok: false, error: 'failed' };
	}
	const tab = await readPlaybackTab();
	if (!tab) return { ok: true };
	try {
		const command: TabCommand = { type: 'player/set-volume', level, muted };
		await chrome.tabs.sendMessage(tab.tabId, command);
	} catch {
		// The tab is gone or slow; the volume is remembered and the next playback tab gets it.
	}
	return { ok: true };
}

/** Moves the playback tab's player to a position. It changes nothing else: Now Playing is the same video. */
export async function handleSeek(positionSec: number): Promise<PlayerCommandResponse> {
	const tab = await readPlaybackTab();
	if (!tab) return { ok: false, error: 'no-playback-tab' };
	try {
		const seek: TabCommand = { type: 'player/seek', positionSec };
		await chrome.tabs.sendMessage(tab.tabId, seek);
		return { ok: true };
	} catch {
		return { ok: false, error: 'failed' };
	}
}

/** Carries out a command from the side panel on the playback tab. */
export async function handlePanelCommand(
	command: PlayerCommandRequest['command']
): Promise<PlayerCommandResponse> {
	if (command === 'resume') {
		const outcome = await resumePlayback();
		return outcome === 'ok' ? { ok: true } : { ok: false, error: outcome };
	}
	if (command === 'check') {
		await checkPlaybackTab();
		return { ok: true };
	}

	const tab = await readPlaybackTab();
	if (!tab) return { ok: false, error: 'no-playback-tab' };

	try {
		if (command === 'go-to-video') {
			// Bring the tab, and the window it is in, to the front.
			await chrome.tabs.update(tab.tabId, { active: true });
			await chrome.windows.update(tab.windowId, { focused: true });
			return { ok: true };
		}
		const tabCommand: TabCommand = { type: 'player/command', command: command as 'play' | 'pause' };
		await chrome.tabs.sendMessage(tab.tabId, tabCommand);
		return { ok: true };
	} catch {
		return { ok: false, error: 'failed' };
	}
}
