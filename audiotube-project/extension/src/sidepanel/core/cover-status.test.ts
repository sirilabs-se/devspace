import { describe, expect, it, vi } from 'vitest';
import type { OverlayStatus } from '../../shared';
import { createCoverStatusController, type CoverStatusDeps } from './cover-status';

function setup(options: { initial?: Record<number, OverlayStatus>; active?: number | null } = {}) {
	let watcher!: (statuses: Record<number, OverlayStatus>) => void;
	let tabChanged!: () => void;
	let active = options.active === undefined ? 1 : options.active;
	const stopWatching = vi.fn();
	const deps: CoverStatusDeps = {
		read: async () => options.initial ?? {},
		watch: (listener) => {
			watcher = listener;
			return stopWatching;
		},
		activeTabId: async () => active,
		onActiveTabChange: (listener) => {
			tabChanged = listener;
			return () => {};
		}
	};
	const controller = createCoverStatusController(deps);
	return {
		controller,
		stopWatching,
		statuses: (s: Record<number, OverlayStatus>) => watcher(s),
		activate: async (id: number | null) => {
			active = id;
			tabChanged();
			await Promise.resolve();
			await Promise.resolve();
		}
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createCoverStatusController', () => {
	it('is quiet when the tab being looked at has no problem', async () => {
		const { controller } = setup();
		await settle();
		expect(controller.get()).toEqual({ coverFailed: false });
	});

	it('shows the problem of the active tab', async () => {
		const { controller } = setup({ initial: { 1: 'failed' }, active: 1 });
		await settle();
		expect(controller.get()).toEqual({ coverFailed: true });
	});

	it('ignores a problem in a tab that is not the active one', async () => {
		const { controller } = setup({ initial: { 2: 'failed' }, active: 1 });
		await settle();
		expect(controller.get().coverFailed).toBe(false);
	});

	it('follows the status as it changes, including when it clears', async () => {
		const { controller, statuses } = setup();
		await settle();
		const seen: boolean[] = [];
		controller.subscribe((view) => seen.push(view.coverFailed));
		statuses({ 1: 'failed' });
		statuses({});
		expect(seen).toEqual([false, true, false]);
	});

	it('follows the active tab', async () => {
		const { controller, activate } = setup({ initial: { 5: 'failed' }, active: 1 });
		await settle();
		expect(controller.get().coverFailed).toBe(false);
		await activate(5);
		expect(controller.get().coverFailed).toBe(true);
		await activate(null);
		expect(controller.get().coverFailed).toBe(false);
	});

	it('stops listening when disposed', async () => {
		const { controller, stopWatching } = setup();
		controller.dispose();
		expect(stopWatching).toHaveBeenCalled();
	});
});
