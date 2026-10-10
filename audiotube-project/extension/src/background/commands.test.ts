import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePanelCommand, handleSeek, handleSetVolume } from './commands';

const sendMessage = vi.fn();
const tabsUpdate = vi.fn();
const windowsUpdate = vi.fn();
let session: Record<string, unknown>;
let local: Record<string, unknown>;
const localSet = vi.fn();

beforeEach(() => {
	session = {};
	local = {};
	localSet.mockReset().mockImplementation(async (items: Record<string, unknown>) => {
		Object.assign(local, items);
	});
	sendMessage.mockReset().mockResolvedValue(undefined);
	tabsUpdate.mockReset().mockResolvedValue({});
	windowsUpdate.mockReset().mockResolvedValue({});
	vi.stubGlobal('chrome', {
		storage: {
			local: { set: localSet },
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

describe('handleSeek', () => {
	it('passes the position to the playback tab', async () => {
		withTab();
		expect(await handleSeek(321)).toEqual({ ok: true });
		expect(sendMessage).toHaveBeenCalledWith(5, { type: 'player/seek', positionSec: 321 });
	});

	it('says so when there is no playback tab', async () => {
		expect(await handleSeek(10)).toEqual({ ok: false, error: 'no-playback-tab' });
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('reports a failure when the tab cannot be reached', async () => {
		withTab();
		sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));
		expect(await handleSeek(10)).toEqual({ ok: false, error: 'failed' });
	});

	it('does not change what is Now Playing', async () => {
		withTab();
		await handleSeek(10);
		expect(sendMessage).toHaveBeenCalledTimes(1);
	});
});

describe('handleSetVolume', () => {
	it('remembers the volume and applies it to the playback tab', async () => {
		withTab();
		expect(await handleSetVolume(45, true)).toEqual({ ok: true });
		expect(local.volume).toEqual({ level: 45, muted: true });
		expect(sendMessage).toHaveBeenCalledWith(5, {
			type: 'player/set-volume',
			level: 45,
			muted: true
		});
	});

	it('still remembers it when there is no playback tab', async () => {
		expect(await handleSetVolume(70, false)).toEqual({ ok: true });
		expect(local.volume).toEqual({ level: 70, muted: false });
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('refuses a volume that is not 0 to 100', async () => {
		expect(await handleSetVolume(150, false)).toEqual({ ok: false, error: 'failed' });
		expect(await handleSetVolume(-1, false)).toEqual({ ok: false, error: 'failed' });
		expect(await handleSetVolume(20.5, false)).toEqual({ ok: false, error: 'failed' });
		expect(localSet).not.toHaveBeenCalled();
	});

	it('reports a failed save and sends nothing', async () => {
		withTab();
		localSet.mockRejectedValue(new Error('QUOTA_BYTES'));
		expect(await handleSetVolume(30, false)).toEqual({ ok: false, error: 'failed' });
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('keeps the volume even when the tab cannot be reached', async () => {
		withTab();
		sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));
		expect(await handleSetVolume(30, false)).toEqual({ ok: true });
		expect(local.volume).toEqual({ level: 30, muted: false });
	});
});
