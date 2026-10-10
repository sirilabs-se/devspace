import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Volume } from '../../shared';
import {
	createVolumeController,
	UNMUTE_FROM_ZERO,
	VOLUME_HOLD_MS,
	VOLUME_SEND_EVERY_MS,
	type VolumeDeps
} from './volume';

function setup(initial: Volume | null = null) {
	let watcher!: (v: Volume | null) => void;
	const stop = vi.fn();
	const set = vi.fn<VolumeDeps['set']>().mockResolvedValue({ ok: true });
	const controller = createVolumeController({
		read: async () => initial,
		watch: (l) => {
			watcher = l;
			return stop;
		},
		set
	});
	return { controller, set, stop, store: (v: Volume | null) => watcher(v) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createVolumeController', () => {
	it('is not known until a volume is stored, and then shows it', async () => {
		const { controller } = setup({ level: 40, muted: true });
		expect(controller.get().known).toBe(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(controller.get()).toEqual({ known: true, level: 40, muted: true });
	});

	it('shows the asked-for level at once and sends it', async () => {
		const { controller, set } = setup({ level: 40, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		controller.setLevel(70);
		expect(controller.get().level).toBe(70);
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS);
		expect(set).toHaveBeenCalledWith(70, false);
	});

	it('sends a drag at a limited rate and always ends with the last value', async () => {
		const { controller, set } = setup({ level: 10, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		for (let level = 11; level <= 60; level++) controller.setLevel(level);
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS * 3);
		expect(set.mock.calls.length).toBeLessThan(5);
		expect(set).toHaveBeenLastCalledWith(60, false);
	});

	it('moving the level above 0 unmutes', async () => {
		const { controller, set } = setup({ level: 40, muted: true });
		await vi.advanceTimersByTimeAsync(0);
		controller.setLevel(55);
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS);
		expect(set).toHaveBeenLastCalledWith(55, false);
	});

	it('mutes and unmutes without losing the level', async () => {
		const { controller, set } = setup({ level: 40, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		controller.toggleMute();
		expect(controller.get()).toMatchObject({ level: 40, muted: true });
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS);
		expect(set).toHaveBeenLastCalledWith(40, true);
		controller.toggleMute();
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS * 2);
		expect(set).toHaveBeenLastCalledWith(40, false);
	});

	it('unmuting a volume of 0 brings it back up', async () => {
		const { controller } = setup({ level: 0, muted: true });
		await vi.advanceTimersByTimeAsync(0);
		controller.toggleMute();
		expect(controller.get()).toMatchObject({ level: UNMUTE_FROM_ZERO, muted: false });
	});

	it('follows a change made on YouTube', async () => {
		const { controller, store } = setup({ level: 40, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		store({ level: 15, muted: true });
		expect(controller.get()).toEqual({ known: true, level: 15, muted: true });
	});

	it('goes back to the stored volume when the change cannot be saved', async () => {
		const { controller, set } = setup({ level: 40, muted: false });
		set.mockResolvedValue({ ok: false, error: 'failed' });
		await vi.advanceTimersByTimeAsync(0);
		controller.setLevel(90);
		await vi.advanceTimersByTimeAsync(VOLUME_SEND_EVERY_MS + 10);
		expect(controller.get().level).toBe(40);
	});

	it('goes back to the stored volume if nothing arrives', async () => {
		const { controller } = setup({ level: 40, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		controller.setLevel(90);
		await vi.advanceTimersByTimeAsync(VOLUME_HOLD_MS + 10);
		expect(controller.get().level).toBe(40);
	});

	it('keeps level between 0 and 100', async () => {
		const { controller } = setup({ level: 40, muted: false });
		await vi.advanceTimersByTimeAsync(0);
		controller.setLevel(400);
		expect(controller.get().level).toBe(100);
		controller.setLevel(-20);
		expect(controller.get().level).toBe(0);
	});

	it('stops listening when disposed', () => {
		const { controller, stop } = setup();
		controller.dispose();
		expect(stop).toHaveBeenCalled();
	});
});
