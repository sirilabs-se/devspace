import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePanelCommand } from './commands';

const sendMessage = vi.fn();
const tabsUpdate = vi.fn();
const windowsUpdate = vi.fn();
let session: Record<string, unknown>;

beforeEach(() => {
	session = {};
	sendMessage.mockReset().mockResolvedValue(undefined);
	tabsUpdate.mockReset().mockResolvedValue({});
	windowsUpdate.mockReset().mockResolvedValue({});
	vi.stubGlobal('chrome', {
		storage: {
			session: { get: async (key: string) => (key in session ? { [key]: session[key] } : {}) }
		},
		tabs: { sendMessage, update: tabsUpdate },
		windows: { update: windowsUpdate }
	});
});

afterEach(() => vi.unstubAllGlobals());

const withTab = () => {
	session.playbackTab = { tabId: 5, windowId: 2, state: 'playing', stateAt: 1 };
};

describe('handlePanelCommand', () => {
	it('passes play and pause to the playback tab', async () => {
		withTab();
		expect(await handlePanelCommand('pause')).toEqual({ ok: true });
		expect(sendMessage).toHaveBeenCalledWith(5, { type: 'player/command', command: 'pause' });
		await handlePanelCommand('play');
		expect(sendMessage).toHaveBeenLastCalledWith(5, { type: 'player/command', command: 'play' });
	});

	it('brings the tab and its window to the front for go-to-video', async () => {
		withTab();
		expect(await handlePanelCommand('go-to-video')).toEqual({ ok: true });
		expect(tabsUpdate).toHaveBeenCalledWith(5, { active: true });
		expect(windowsUpdate).toHaveBeenCalledWith(2, { focused: true });
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('says so when there is no playback tab', async () => {
		expect(await handlePanelCommand('pause')).toEqual({ ok: false, error: 'no-playback-tab' });
		expect(await handlePanelCommand('go-to-video')).toEqual({
			ok: false,
			error: 'no-playback-tab'
		});
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('reports a failure when the tab cannot be reached', async () => {
		withTab();
		sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));
		expect(await handlePanelCommand('pause')).toEqual({ ok: false, error: 'failed' });
	});
});
