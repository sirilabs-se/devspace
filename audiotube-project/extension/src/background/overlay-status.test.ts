import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetStatusesOfGoneTabs, recordOverlayStatus } from './overlay-status';

const set = vi.fn();
const remove = vi.fn();
let onRemoved: (tabId: number) => void;
let onUpdated: (tabId: number, changeInfo: { status?: string }) => void;

beforeEach(() => {
	set.mockReset().mockResolvedValue(undefined);
	remove.mockReset().mockResolvedValue(undefined);
	vi.stubGlobal('chrome', {
		storage: { session: { set, remove } },
		tabs: {
			onRemoved: { addListener: (l: typeof onRemoved) => (onRemoved = l) },
			onUpdated: { addListener: (l: typeof onUpdated) => (onUpdated = l) }
		}
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('recordOverlayStatus', () => {
	it('keeps a failed status under the tab in session storage', async () => {
		await recordOverlayStatus(12, 'failed');
		expect(set).toHaveBeenCalledWith({ 'overlayStatus:12': 'failed' });
	});

	it('removes the entry when the tab is fine again', async () => {
		await recordOverlayStatus(12, 'ok');
		expect(remove).toHaveBeenCalledWith('overlayStatus:12');
		expect(set).not.toHaveBeenCalled();
	});
});

describe('forgetStatusesOfGoneTabs', () => {
	it('clears a tab that is closed', () => {
		forgetStatusesOfGoneTabs();
		onRemoved(5);
		expect(remove).toHaveBeenCalledWith('overlayStatus:5');
	});

	it('clears a tab that starts loading a new page, but not other updates', () => {
		forgetStatusesOfGoneTabs();
		onUpdated(7, { status: 'complete' });
		expect(remove).not.toHaveBeenCalled();
		onUpdated(7, { status: 'loading' });
		expect(remove).toHaveBeenCalledWith('overlayStatus:7');
	});
});
