import { checkPlaybackTab, resumePlayback } from './playback';
import {
	readPlaybackTab,
	type PlayerCommandRequest,
	type PlayerCommandResponse,
	type TabCommand
} from '../shared';

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
		const tabCommand: TabCommand = { type: 'player/command', command };
		await chrome.tabs.sendMessage(tab.tabId, tabCommand);
		return { ok: true };
	} catch {
		return { ok: false, error: 'failed' };
	}
}
