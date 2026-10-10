import { checkPlaybackTab, resumePlayback } from './playback';
import {
	readPlaybackTab,
	type PlayerCommandRequest,
	type PlayerCommandResponse,
	type TabCommand
} from '../shared';

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
