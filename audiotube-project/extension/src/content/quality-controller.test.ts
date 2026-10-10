import { describe, expect, it, vi } from 'vitest';
import type { ContentToPage, Settings } from '../shared';
import { startQualityController } from './quality-controller';

function setup(initial: Settings = { audioOnly: true, saveBandwidth: true }) {
	let watcher!: (settings: Settings) => void;
	let ready!: () => void;
	const send = vi.fn<(message: ContentToPage) => void>();
	const stop = startQualityController({
		read: async () => initial,
		watch: (listener) => {
			watcher = listener;
			return () => {};
		},
		send,
		onPageReady: (handler) => {
			ready = handler;
			return () => {};
		}
	});
	return { send, stop, change: (s: Settings) => watcher(s), pageReady: () => ready() };
}

const lowest = { type: 'quality/set', mode: 'lowest' } as const;
const normal = { type: 'quality/set', mode: 'normal' } as const;

describe('startQualityController', () => {
	it('asks for the lowest quality when audio-only and Save bandwidth are on', async () => {
		const { send } = setup();
		await vi.waitFor(() => expect(send).toHaveBeenCalledWith(lowest));
	});

	it('does not ask for it when Save bandwidth is off', async () => {
		const { send } = setup({ audioOnly: true, saveBandwidth: false });
		await vi.waitFor(() => expect(send).toHaveBeenCalledWith(normal));
		expect(send).not.toHaveBeenCalledWith(lowest);
	});

	it('goes back to normal when audio-only turns off, and to lowest when it turns on', async () => {
		const { send, change } = setup();
		await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
		change({ audioOnly: false, saveBandwidth: true });
		expect(send).toHaveBeenLastCalledWith(normal);
		change({ audioOnly: true, saveBandwidth: true });
		expect(send).toHaveBeenLastCalledWith(lowest);
	});

	it('says nothing when a change does not alter the mode', async () => {
		const { send, change } = setup();
		await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
		change({ audioOnly: true, saveBandwidth: true });
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('repeats the mode when the page script starts after it', async () => {
		const { send, pageReady } = setup();
		await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
		pageReady();
		expect(send).toHaveBeenCalledTimes(2);
		expect(send).toHaveBeenLastCalledWith(lowest);
	});
});
