import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenForRequests } from './message-handler';

type Handler = (
	message: unknown,
	sender: { id?: string },
	sendResponse: (response: unknown) => void
) => boolean;

let handler: Handler;
const set = vi.fn();

beforeEach(() => {
	set.mockReset();
	set.mockResolvedValue(undefined);
	vi.stubGlobal('chrome', {
		runtime: {
			id: 'our-extension',
			onMessage: { addListener: (h: Handler) => (handler = h) }
		},
		storage: { local: { set } }
	});
	listenForRequests();
});

afterEach(() => vi.unstubAllGlobals());

describe('listenForRequests', () => {
	it('answers a set-audio-only request from our own extension', async () => {
		const sendResponse = vi.fn();
		const keepOpen = handler(
			{ type: 'settings/set-audio-only', value: false },
			{ id: 'our-extension' },
			sendResponse
		);
		expect(keepOpen).toBe(true);
		await vi.waitFor(() =>
			expect(sendResponse).toHaveBeenCalledWith({ ok: true, audioOnly: false })
		);
		expect(set).toHaveBeenCalledWith({ audioOnly: false });
	});

	it('returns a typed error for an invalid value', async () => {
		const sendResponse = vi.fn();
		handler({ type: 'settings/set-audio-only', value: 'x' }, { id: 'our-extension' }, sendResponse);
		await vi.waitFor(() =>
			expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'invalid-value' })
		);
		expect(set).not.toHaveBeenCalled();
	});

	it('ignores messages from other extensions', () => {
		const sendResponse = vi.fn();
		const keepOpen = handler(
			{ type: 'settings/set-audio-only', value: false },
			{ id: 'someone-else' },
			sendResponse
		);
		expect(keepOpen).toBe(false);
		expect(set).not.toHaveBeenCalled();
	});

	it('ignores messages it does not know', () => {
		const keepOpen = handler({ type: 'nope' }, { id: 'our-extension' }, vi.fn());
		expect(keepOpen).toBe(false);
		expect(set).not.toHaveBeenCalled();
	});
});
