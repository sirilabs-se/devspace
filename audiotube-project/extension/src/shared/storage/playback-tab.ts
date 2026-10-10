export const PLAYBACK_TAB_KEY = 'playbackTab';

export type PlayState = 'playing' | 'paused' | 'buffering' | 'ended';
const PLAY_STATES: readonly PlayState[] = ['playing', 'paused', 'buffering', 'ended'];

/** The one YouTube tab whose player is making the sound. Kept in session storage, so a restart clears it. */
export interface PlaybackTab {
	tabId: number;
	windowId: number;
	state: PlayState;
	/** Epoch milliseconds: when the state, position and rate below were true. */
	stateAt: number;
	/** Where the video was at `stateAt`, in seconds. The side panel counts forward from it (ADR 0007). */
	positionSec: number;
	/** The playback rate at `stateAt`. */
	rate: number;
}

export function isPlayState(value: unknown): value is PlayState {
	return typeof value === 'string' && (PLAY_STATES as readonly string[]).includes(value);
}

const wholeNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

/** A stored value that is missing or not valid reads as no playback tab. */
export function parsePlaybackTab(raw: unknown): PlaybackTab | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const v = raw as Record<string, unknown>;
	const tabId = wholeNumber(v.tabId);
	const windowId = wholeNumber(v.windowId);
	const stateAt = wholeNumber(v.stateAt);
	if (tabId === null || windowId === null || stateAt === null || !isPlayState(v.state)) return null;
	const positionSec =
		typeof v.positionSec === 'number' && Number.isFinite(v.positionSec) && v.positionSec >= 0
			? v.positionSec
			: 0;
	const rate =
		typeof v.rate === 'number' && Number.isFinite(v.rate) && v.rate > 0 && v.rate <= 16
			? v.rate
			: 1;
	return { tabId, windowId, state: v.state, stateAt, positionSec, rate };
}

export async function readPlaybackTab(): Promise<PlaybackTab | null> {
	const items = await chrome.storage.session.get(PLAYBACK_TAB_KEY);
	return parsePlaybackTab(items[PLAYBACK_TAB_KEY]);
}

export function watchPlaybackTab(listener: (tab: PlaybackTab | null) => void): () => void {
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'session' || !(PLAYBACK_TAB_KEY in changes)) return;
		readPlaybackTab().then(listener, () => {});
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
