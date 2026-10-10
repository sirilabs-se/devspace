import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayStatus, Settings } from '../shared';
import { startCoverStatusController } from './cover-status-controller';

function setup(initial: Settings = { audioOnly: true, saveBandwidth: true }) {
	const page = { watch: true, player: false };
	let settings!: (s: Settings) => void;
	let pageChanged!: () => void;
	const report = vi.fn<(status: OverlayStatus) => void>();
	const stop = startCoverStatusController({
		read: async () => initial,
		watch: (listener) => {
			settings = listener;
			return () => {};
		},
		onWatchPage: () => page.watch,
		playerPresent: () => page.player,
		report,
		onPageChange: (callback) => {
			pageChanged = callback;
			return () => {};
		},
		waitMs: 5000
	});
	return {
		page,
		report,
		stop,
		changeSettings: (s: Settings) => settings(s),
		pageChanged: () => pageChanged()
	};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startCoverStatusController', () => {
	it('says ok at once when the player is there', async () => {
		const { page, report } = setup();
		page.player = true;
		await vi.advanceTimersByTimeAsync(0);
		expect(report).toHaveBeenCalledWith('ok');
		expect(report).not.toHaveBeenCalledWith('failed');
	});

	it('says failed only after the wait when the player cannot be found', async () => {
		const { report } = setup();
		await vi.advanceTimersByTimeAsync(4999);
		expect(report).not.toHaveBeenCalledWith('failed');
		await vi.advanceTimersByTimeAsync(2);
		expect(report).toHaveBeenCalledWith('failed');
	});

	it('does not say failed if the player appears within the wait', async () => {
		const { page, report, pageChanged } = setup();
		await vi.advanceTimersByTimeAsync(3000);
		page.player = true;
		pageChanged();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(report).not.toHaveBeenCalledWith('failed');
		expect(report).toHaveBeenLastCalledWith('ok');
	});

	it('says ok again when the player appears later', async () => {
		const { page, report, pageChanged } = setup();
		await vi.advanceTimersByTimeAsync(6000);
		expect(report).toHaveBeenLastCalledWith('failed');
		page.player = true;
		pageChanged();
		expect(report).toHaveBeenLastCalledWith('ok');
	});

	it('says nothing is wrong off a watch page or with audio-only off', async () => {
		const { page, report, changeSettings, pageChanged } = setup();
		await vi.advanceTimersByTimeAsync(6000);
		expect(report).toHaveBeenLastCalledWith('failed');
		page.watch = false;
		pageChanged();
		expect(report).toHaveBeenLastCalledWith('ok');

		page.watch = true;
		pageChanged();
		await vi.advanceTimersByTimeAsync(6000);
		expect(report).toHaveBeenLastCalledWith('failed');
		changeSettings({ audioOnly: false, saveBandwidth: true });
		expect(report).toHaveBeenLastCalledWith('ok');
	});

	it('reports each change once', async () => {
		const { report, pageChanged } = setup();
		await vi.advanceTimersByTimeAsync(6000);
		pageChanged();
		pageChanged();
		await vi.advanceTimersByTimeAsync(6000);
		expect(report.mock.calls.filter(([s]) => s === 'failed')).toHaveLength(1);
	});
});
