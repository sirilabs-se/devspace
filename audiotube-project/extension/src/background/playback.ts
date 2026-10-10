import {
	cleanText,
	CHANNEL_MAX,
	NOW_PLAYING_KEY,
	PLAYBACK_TAB_KEY,
	readNowPlaying,
	readPlaybackTab,
	TITLE_MAX,
	type NowPlaying,
	type PlayerReport,
	type PlayerVideoDetails,
	type PlaybackTab,
	type TabCommand
} from '../shared';

const TAB_VIDEO_PREFIX = 'tabVideo:';
const tabVideoKey = (tabId: number) => `${TAB_VIDEO_PREFIX}${tabId}`;

export interface ReportingTab {
	tabId: number;
	windowId: number;
}

let queue: Promise<void> = Promise.resolve();

/**
 * Handles one report from a tab's main player. Reports are applied one after another, because each reads
 * stored state and writes it back. The tab comes from the message's sender, never from its body.
 */
export function handlePlayerReport(
	report: PlayerReport,
	tab: ReportingTab,
	now: number = Date.now()
): Promise<void> {
	queue = queue.then(() => apply(report, tab, now)).catch(() => {});
	return queue;
}

function toNowPlaying(video: PlayerVideoDetails, positionSec: number, now: number): NowPlaying {
	return {
		videoId: video.videoId,
		title: cleanText(video.title, TITLE_MAX),
		channel: cleanText(video.channel, CHANNEL_MAX),
		durationSec: video.isLive ? null : video.durationSec,
		isLive: video.isLive,
		positionSec: Math.floor(positionSec),
		positionSavedAt: now,
		updatedAt: now
	};
}

async function readTabVideo(tabId: number): Promise<PlayerVideoDetails | null> {
	const items = await chrome.storage.session.get(tabVideoKey(tabId));
	const value = items[tabVideoKey(tabId)] as PlayerVideoDetails | undefined;
	return value && typeof value.videoId === 'string' ? value : null;
}

async function savePosition(positionSec: number, now: number): Promise<void> {
	const current = await readNowPlaying();
	if (!current) return;
	await chrome.storage.local.set({
		[NOW_PLAYING_KEY]: { ...current, positionSec: Math.floor(positionSec), positionSavedAt: now }
	});
}

async function apply(report: PlayerReport, tab: ReportingTab, now: number): Promise<void> {
	if (report.type === 'player/video') {
		const { type: _type, ...video } = report;
		void _type;
		await chrome.storage.session.set({ [tabVideoKey(tab.tabId)]: video });
		// A different video in the playback tab replaces Now Playing (PLY-045).
		const playbackTab = await readPlaybackTab();
		if (playbackTab?.tabId === tab.tabId) {
			const current = await readNowPlaying();
			if (current?.videoId === video.videoId) {
				await chrome.storage.local.set({
					[NOW_PLAYING_KEY]: {
						...current,
						title: cleanText(video.title, TITLE_MAX),
						channel: cleanText(video.channel, CHANNEL_MAX),
						durationSec: video.isLive ? null : video.durationSec,
						isLive: video.isLive
					}
				});
			} else {
				await chrome.storage.local.set({ [NOW_PLAYING_KEY]: toNowPlaying(video, 0, now) });
			}
		}
		return;
	}

	const playbackTab = await readPlaybackTab();
	const isPlaybackTab = playbackTab?.tabId === tab.tabId;

	if (report.type === 'player/position') {
		if (isPlaybackTab) await savePosition(report.positionSec, now);
		return;
	}

	// player/state
	if (report.state === 'playing' && !isPlaybackTab) {
		await takeOver(tab, report.positionSec, now);
		return;
	}
	if (!isPlaybackTab) return;
	const next: PlaybackTab = { ...playbackTab, state: report.state, stateAt: now };
	await chrome.storage.session.set({ [PLAYBACK_TAB_KEY]: next });
	await savePosition(report.positionSec, now);
}

/** The tab that starts playing becomes the playback tab, and its video Now Playing. */
async function takeOver(tab: ReportingTab, positionSec: number, now: number): Promise<void> {
	const video = await readTabVideo(tab.tabId);
	if (!video) return;
	const current = await readNowPlaying();
	const nowPlaying =
		current?.videoId === video.videoId
			? { ...current, positionSec: Math.floor(positionSec), positionSavedAt: now }
			: toNowPlaying(video, positionSec, now);
	await chrome.storage.local.set({ [NOW_PLAYING_KEY]: nowPlaying });
	const previous = await readPlaybackTab();
	const playbackTab: PlaybackTab = {
		tabId: tab.tabId,
		windowId: tab.windowId,
		state: 'playing',
		stateAt: now
	};
	await chrome.storage.session.set({ [PLAYBACK_TAB_KEY]: playbackTab });
	// Chrome must not discard the one tab that is making the sound (PLY-050).
	await chrome.tabs.update(tab.tabId, { autoDiscardable: false }).catch(() => {});

	// There is one playback tab (GLB-001): the old one is paused, never closed (PLY-040).
	if (previous && previous.tabId !== tab.tabId) {
		const pause: TabCommand = { type: 'player/command', command: 'pause' };
		await chrome.tabs.sendMessage(previous.tabId, pause).catch(() => {});
		await chrome.tabs.update(previous.tabId, { autoDiscardable: true }).catch(() => {});
	}
}

/** A closed tab, and a tab loading a new page, no longer has a known video. */
export function forgetVideosOfGoneTabs(): void {
	const forget = (tabId: number) => void chrome.storage.session.remove(tabVideoKey(tabId));
	chrome.tabs.onRemoved.addListener(forget);
	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.status === 'loading') forget(tabId);
	});
}
