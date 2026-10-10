import { readOverlayStatuses, watchOverlayStatuses, type OverlayStatus } from '../../shared';

export interface CoverStatusView {
	/** True when the overlay could not be put on the player of the tab being looked at. */
	coverFailed: boolean;
}

export interface CoverStatusController {
	get(): CoverStatusView;
	subscribe(listener: (view: CoverStatusView) => void): () => void;
	dispose(): void;
}

export interface CoverStatusDeps {
	read: () => Promise<Record<number, OverlayStatus>>;
	watch: (listener: (statuses: Record<number, OverlayStatus>) => void) => () => void;
	/** The tab being looked at in this panel's own window, if any. */
	activeTabId: () => Promise<number | null>;
	onActiveTabChange: (listener: () => void) => () => void;
}

async function activeTabInThisWindow(): Promise<number | null> {
	try {
		const { id: windowId } = await chrome.windows.getCurrent();
		const [tab] = await chrome.tabs.query({ active: true, windowId });
		return tab?.id ?? null;
	} catch {
		return null;
	}
}

const defaultDeps: CoverStatusDeps = {
	read: readOverlayStatuses,
	watch: watchOverlayStatuses,
	activeTabId: activeTabInThisWindow,
	onActiveTabChange(listener) {
		chrome.tabs.onActivated.addListener(listener);
		return () => chrome.tabs.onActivated.removeListener(listener);
	}
};

export function createCoverStatusController(
	deps: CoverStatusDeps = defaultDeps
): CoverStatusController {
	let view: CoverStatusView = { coverFailed: false };
	let statuses: Record<number, OverlayStatus> = {};
	let activeTab: number | null = null;
	let refreshes = 0;
	const listeners = new Set<(view: CoverStatusView) => void>();

	function publish() {
		const coverFailed = activeTab !== null && statuses[activeTab] === 'failed';
		if (coverFailed === view.coverFailed) return;
		view = { coverFailed };
		for (const listener of listeners) listener(view);
	}

	async function refreshActiveTab() {
		const ticket = ++refreshes;
		const id = await deps.activeTabId();
		if (ticket !== refreshes) return;
		activeTab = id;
		publish();
	}

	const stopWatching = deps.watch((next) => {
		statuses = next;
		publish();
	});
	const stopTabs = deps.onActiveTabChange(() => void refreshActiveTab());

	deps.read().then(
		(next) => {
			statuses = next;
			publish();
		},
		() => {}
	);
	void refreshActiveTab();

	return {
		get: () => view,
		subscribe(listener) {
			listeners.add(listener);
			listener(view);
			return () => listeners.delete(listener);
		},
		dispose() {
			stopWatching();
			stopTabs();
			listeners.clear();
		}
	};
}
