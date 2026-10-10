import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepEarlyCssInStep, syncEarlyCss } from './early-css';

const getRegisteredContentScripts = vi.fn();
const registerContentScripts = vi.fn();
const unregisterContentScripts = vi.fn();

beforeEach(() => {
	for (const fn of [
		getRegisteredContentScripts,
		registerContentScripts,
		unregisterContentScripts
	]) {
		fn.mockReset();
		fn.mockResolvedValue(fn === getRegisteredContentScripts ? [] : undefined);
	}
	vi.stubGlobal('chrome', {
		scripting: { getRegisteredContentScripts, registerContentScripts, unregisterContentScripts }
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('syncEarlyCss', () => {
	it('registers the CSS at document_start while audio-only is on', async () => {
		await syncEarlyCss(true);
		expect(registerContentScripts).toHaveBeenCalledWith([
			expect.objectContaining({
				matches: ['https://www.youtube.com/*'],
				css: ['early.css'],
				runAt: 'document_start'
			})
		]);
		expect(registerContentScripts.mock.calls[0]![0][0]).not.toHaveProperty('js');
	});

	it('does not register it twice', async () => {
		getRegisteredContentScripts.mockResolvedValue([{ id: 'audiotube-early-css' }]);
		await syncEarlyCss(true);
		expect(registerContentScripts).not.toHaveBeenCalled();
	});

	it('removes it when audio-only is off', async () => {
		getRegisteredContentScripts.mockResolvedValue([{ id: 'audiotube-early-css' }]);
		await syncEarlyCss(false);
		expect(unregisterContentScripts).toHaveBeenCalledWith({ ids: ['audiotube-early-css'] });
	});

	it('does nothing when it is off and nothing is registered', async () => {
		await syncEarlyCss(false);
		expect(unregisterContentScripts).not.toHaveBeenCalled();
	});
});

describe('keepEarlyCssInStep', () => {
	it('follows the saved value, one change after another', async () => {
		let listener!: (settings: { audioOnly: boolean }) => void;
		let registered = false;
		getRegisteredContentScripts.mockImplementation(async () =>
			registered ? [{ id: 'audiotube-early-css' }] : []
		);
		registerContentScripts.mockImplementation(async () => (registered = true));
		unregisterContentScripts.mockImplementation(async () => (registered = false));

		keepEarlyCssInStep(
			async () => ({ audioOnly: true }),
			(l) => {
				listener = l;
				return () => {};
			}
		);
		await vi.waitFor(() => expect(registerContentScripts).toHaveBeenCalledTimes(1));
		listener({ audioOnly: false });
		await vi.waitFor(() => expect(unregisterContentScripts).toHaveBeenCalledTimes(1));
		listener({ audioOnly: true });
		await vi.waitFor(() => expect(registerContentScripts).toHaveBeenCalledTimes(2));
	});
});
