import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetAudioOnlyResponse, Settings } from '../../shared';
import { createAudioOnlyController, type AudioOnlyDeps } from './audio-only';

function setup(options: { saved?: boolean; request?: AudioOnlyDeps['request'] } = {}) {
	let watcher: ((settings: Settings) => void) | undefined;
	const stopWatching = vi.fn();
	const request = vi.fn(
		options.request ??
			(async (value: boolean): Promise<SetAudioOnlyResponse> => ({ ok: true, audioOnly: value }))
	);
	const deps: AudioOnlyDeps = {
		read: async () => ({ audioOnly: options.saved ?? true, saveBandwidth: true }),
		watch: (listener) => {
			watcher = listener;
			return stopWatching;
		},
		request
	};
	const controller = createAudioOnlyController(deps);
	return {
		controller,
		request,
		stopWatching,
		emitChange: (audioOnly: boolean) => watcher?.({ audioOnly, saveBandwidth: true }),
		emitSettings: (settings: Settings) => watcher?.(settings)
	};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAudioOnlyController', () => {
	it('is not ready until the saved value is read, then shows it', async () => {
		const { controller } = setup({ saved: false });
		expect(controller.get().ready).toBe(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(controller.get()).toEqual({
			ready: true,
			audioOnly: false,
			saveBandwidth: true,
			error: null
		});
	});

	it('shows on when nothing is saved', async () => {
		const { controller } = setup();
		await vi.advanceTimersByTimeAsync(0);
		expect(controller.get().audioOnly).toBe(true);
	});

	it('sends a set request and keeps the new position when saving works', async () => {
		const { controller, request } = setup();
		await vi.advanceTimersByTimeAsync(0);
		await controller.set(false);
		expect(request).toHaveBeenCalledWith(false);
		expect(controller.get()).toEqual({
			ready: true,
			audioOnly: false,
			saveBandwidth: true,
			error: null
		});
	});

	it('shows the new position straight away, before the save is confirmed', async () => {
		let finish!: (response: SetAudioOnlyResponse) => void;
		const { controller } = setup({ request: () => new Promise((resolve) => (finish = resolve)) });
		await vi.advanceTimersByTimeAsync(0);
		const pending = controller.set(false);
		expect(controller.get().audioOnly).toBe(false);
		finish({ ok: true, audioOnly: false });
		await pending;
	});

	it('goes back to the saved position and reports an error when saving fails', async () => {
		const { controller } = setup({
			request: async () => ({ ok: false, error: 'storage-failed' })
		});
		await vi.advanceTimersByTimeAsync(0);
		await controller.set(false);
		expect(controller.get()).toEqual({
			ready: true,
			audioOnly: true,
			saveBandwidth: true,
			error: 'save-failed'
		});
	});

	it('clears the error after a few seconds and when the next change works', async () => {
		let ok = false;
		const { controller } = setup({
			request: async (value) =>
				ok ? { ok: true, audioOnly: value } : { ok: false, error: 'background-unavailable' }
		});
		await vi.advanceTimersByTimeAsync(0);
		await controller.set(false);
		expect(controller.get().error).toBe('save-failed');
		await vi.advanceTimersByTimeAsync(6000);
		expect(controller.get().error).toBeNull();

		await controller.set(false);
		expect(controller.get().error).toBe('save-failed');
		ok = true;
		await controller.set(false);
		expect(controller.get().error).toBeNull();
	});

	it('follows a change made elsewhere, such as another window', async () => {
		const { controller, emitChange } = setup();
		await vi.advanceTimersByTimeAsync(0);
		const seen: boolean[] = [];
		controller.subscribe((view) => seen.push(view.audioOnly));
		emitChange(false);
		expect(controller.get().audioOnly).toBe(false);
		expect(seen).toEqual([true, false]);
	});

	it('follows Save bandwidth too', async () => {
		const { controller, emitSettings } = setup();
		await vi.advanceTimersByTimeAsync(0);
		expect(controller.get().saveBandwidth).toBe(true);
		emitSettings({ audioOnly: true, saveBandwidth: false });
		expect(controller.get().saveBandwidth).toBe(false);
	});

	it('uses the change from elsewhere as the position to go back to', async () => {
		const { controller, emitChange } = setup({
			request: async () => ({ ok: false, error: 'storage-failed' })
		});
		await vi.advanceTimersByTimeAsync(0);
		emitChange(false);
		await controller.set(true);
		expect(controller.get().audioOnly).toBe(false);
	});

	it('toggle flips the current position', async () => {
		const { controller, request } = setup();
		await vi.advanceTimersByTimeAsync(0);
		controller.toggle();
		expect(request).toHaveBeenCalledWith(false);
	});

	it('ignores a toggle while the previous change is still being saved', async () => {
		let finish!: (response: SetAudioOnlyResponse) => void;
		const { controller, request } = setup({
			request: () => new Promise((resolve) => (finish = resolve))
		});
		await vi.advanceTimersByTimeAsync(0);
		const first = controller.set(false);
		controller.toggle();
		expect(request).toHaveBeenCalledTimes(1);
		finish({ ok: true, audioOnly: false });
		await first;
	});

	it('stops listening when disposed', async () => {
		const { controller, stopWatching } = setup();
		controller.dispose();
		expect(stopWatching).toHaveBeenCalled();
	});
});
