import {
	cleanText,
	CHANNEL_MAX,
	NOW_PLAYING_KEY,
	PLAYBACK_TAB_KEY,
	readNowPlaying,
	readPendingResume,
	readPlaybackTab,
	RESUME_KEY,
	TITLE_MAX,
	type NowPlaying,
	type PlayerReport,
	type PlayerVideoDetails,
	type PlaybackTab,
	type TabCommand
} from '../shared';

const TAB_VIDEO_PREFIX = 'tabVideo:';
const tabVideoKey = (tabId: number) => `${TAB_VIDEO_PREFIX}${tabId}`;

/** A page load right after Resume opened the tab is that tab starting up, not the playback tab being lost. */
const RESUME_GRACE_MS = 20_000;
/**
 * How long after a page load starts the playback tab is looked at again. YouTube's own in-page moves also
 * raise a "loading" update, so a load alone says nothing; where the tab ends up does.
 */
const AFTER_LOAD_CHECK_MS = 2500;

export interface ReportingTab {
	tabId: number;
	windowId: number;
}

let queue: Promise<void> = Promise.resolve();

/** Everything that reads stored state and writes it back runs one after another. */
function enqueue(job: () => Promise<void>): Promise<void> {
	queue = queue.then(job).catch(() => {});
	return queue;
}

/**
 * Handles one report from a tab's main player. The tab comes from the message's sender, never from its body.
 */
export function handlePlayerReport(
	report: PlayerReport,
	tab: ReportingTab,
	now: number = Date.now()
): Promise<void> {
	return enqueue(() => apply(report, tab, now));
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

	if (report.type === 'player/gone') {
		// The player left the page (and no mini-player took it): the video has stopped, and this tab is not
		// making the sound any more. Now Playing keeps its place for Resume.
		if (isPlaybackTab) {
			if (report.positionSec > 0) await savePosition(report.positionSec, now);
			await loseTab(tab.tabId);
		}
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
	if (report.state === 'playing') await chrome.storage.session.remove(RESUME_KEY);
	// A video that is only loading reports position 0; that must not overwrite the saved position.
	if (report.state !== 'paused' || report.positionSec > 0) {
		await savePosition(report.positionSec, now);
	}
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
	await chrome.storage.session.remove(RESUME_KEY);
	// Chrome must not discard the one tab that is making the sound (PLY-050).
	await chrome.tabs.update(tab.tabId, { autoDiscardable: false }).catch(() => {});

	// There is one playback tab (GLB-001): the old one is paused, never closed (PLY-040).
	if (previous && previous.tabId !== tab.tabId) {
		// Not waited for: a tab that is frozen or slow to answer must not hold up every report behind it.
		const pause: TabCommand = { type: 'player/command', command: 'pause' };
		void chrome.tabs.sendMessage(previous.tabId, pause).catch(() => {});
		void chrome.tabs.update(previous.tabId, { autoDiscardable: true }).catch(() => {});
	}
}

/** The playback tab is gone: forget the tab, keep Now Playing with the position last saved (PLY-052). */
async function loseTab(tabId: number): Promise<void> {
	const playbackTab = await readPlaybackTab();
	if (playbackTab?.tabId !== tabId) return;
	await chrome.storage.session.remove([PLAYBACK_TAB_KEY, RESUME_KEY, tabVideoKey(tabId)]);
}

const isYouTubeUrl = (url: string | undefined) =>
	url?.startsWith('https://www.youtube.com/') === true;

/**
 * Looks at the playback tab and treats one that is gone, unloaded (a crash), discarded or no longer on
 * YouTube as lost. The extension has host access to YouTube only, so a tab on another site has no URL.
 */
export function checkPlaybackTab(): Promise<void> {
	return enqueue(async () => {
		const playbackTab = await readPlaybackTab();
		if (!playbackTab) return;
		try {
			const tab = await chrome.tabs.get(playbackTab.tabId);
			if (tab.discarded || tab.status === 'unloaded' || !isYouTubeUrl(tab.url)) {
				await loseTab(playbackTab.tabId);
			}
		} catch {
			await loseTab(playbackTab.tabId);
		}
	});
}

/**
 * Opens Now Playing's video in a new tab at its saved position, without taking focus, and records that tab as
 * the playback tab at once, so Play and Go to video work on it while it starts.
 */
export function resumePlayback(
	now: number = Date.now()
): Promise<'ok' | 'nothing-to-resume' | 'failed'> {
	let outcome: 'ok' | 'nothing-to-resume' | 'failed' = 'failed';
	return enqueue(async () => {
		const nowPlaying = await readNowPlaying();
		if (!nowPlaying) {
			outcome = 'nothing-to-resume';
			return;
		}
		const existing = await readPlaybackTab();
		if (existing) {
			// There is already a tab for it; Play and Go to video are the way to use it.
			outcome = 'ok';
			return;
		}
		// A live stream has no position to return to.
		const start = nowPlaying.isLive ? '' : `&t=${nowPlaying.positionSec}s`;
		const url = `https://www.youtube.com/watch?v=${nowPlaying.videoId}${start}`;
		const tab = await chrome.tabs.create({ url, active: false });
		if (tab.id === undefined) return;
		const playbackTab: PlaybackTab = {
			tabId: tab.id,
			windowId: tab.windowId,
			state: 'paused',
			stateAt: now
		};
		await chrome.storage.session.set({
			[PLAYBACK_TAB_KEY]: playbackTab,
			[RESUME_KEY]: { tabId: tab.id, startedAt: now }
		});
		await chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
		outcome = 'ok';
	}).then(() => outcome);
}

/** Notices when a tab goes: closed, replaced (a discard), discarded, or moved off YouTube. */
export function watchPlaybackTabLoss(): void {
	const forget = (tabId: number) => void chrome.storage.session.remove(tabVideoKey(tabId));

	chrome.tabs.onRemoved.addListener((tabId) => {
		forget(tabId);
		void enqueue(() => loseTab(tabId));
	});

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.status === 'loading') {
			// A page load starts for in-page moves too. Look again shortly, and only then decide.
			setTimeout(() => {
				void enqueue(async () => {
					const [playbackTab, resume] = [await readPlaybackTab(), await readPendingResume()];
					if (playbackTab?.tabId !== tabId) return;
					// A tab that Resume just opened is loading because it is starting, not because it was lost.
					if (resume?.tabId === tabId && Date.now() - resume.startedAt < RESUME_GRACE_MS) return;
					await checkNow(tabId);
				});
			}, AFTER_LOAD_CHECK_MS);
		}
		if (changeInfo.discarded === true) void enqueue(() => loseTab(tabId));
	});

	// Discarding a tab gives it a new tab ID: the old one is gone, as far as the playback tab goes.
	chrome.tabs.onReplaced.addListener((_addedTabId, removedTabId) => {
		forget(removedTabId);
		void enqueue(() => loseTab(removedTabId));
	});
}

async function checkNow(tabId: number): Promise<void> {
	try {
		const tab = await chrome.tabs.get(tabId);
		if (tab.discarded || tab.status === 'unloaded' || !isYouTubeUrl(tab.url)) await loseTab(tabId);
	} catch {
		await loseTab(tabId);
	}
}
