export const NOW_PLAYING_KEY = 'nowPlaying';
export const TITLE_MAX = 300;
export const CHANNEL_MAX = 100;

/** The one video that is playing or paused as the current item. Carries its own copy of the details. */
export interface NowPlaying {
	videoId: string;
	title: string;
	channel: string;
	/** Null for live streams and upcoming premieres. */
	durationSec: number | null;
	isLive: boolean;
	positionSec: number;
	/** Epoch milliseconds. */
	positionSavedAt: number;
	/** Epoch milliseconds; when the video last changed. */
	updatedAt: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: unknown): value is string {
	return typeof value === 'string' && VIDEO_ID.test(value);
}

/** Plain text only: control characters are dropped, runs of whitespace collapsed, and the length capped. */
export function cleanText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	const spaced = Array.from(value, (char) => {
		const code = char.codePointAt(0)!;
		return code <= 0x1f || code === 0x7f ? ' ' : char;
	}).join('');
	const text = spaced.replace(/\s+/g, ' ').trim();
	return Array.from(text).slice(0, max).join('');
}

function wholeSeconds(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
		? Math.floor(value)
		: null;
}

function epoch(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? Math.floor(value)
		: null;
}

/** A stored value that is missing or not valid reads as nothing playing, never as an error. */
export function parseNowPlaying(raw: unknown): NowPlaying | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const v = raw as Record<string, unknown>;
	if (!isVideoId(v.videoId)) return null;
	const positionSavedAt = epoch(v.positionSavedAt);
	const updatedAt = epoch(v.updatedAt);
	if (positionSavedAt === null || updatedAt === null) return null;
	const isLive = v.isLive === true;
	return {
		videoId: v.videoId,
		title: cleanText(v.title, TITLE_MAX),
		channel: cleanText(v.channel, CHANNEL_MAX),
		durationSec: isLive ? null : wholeSeconds(v.durationSec),
		isLive,
		positionSec: wholeSeconds(v.positionSec) ?? 0,
		positionSavedAt,
		updatedAt
	};
}

export async function readNowPlaying(): Promise<NowPlaying | null> {
	const items = await chrome.storage.local.get(NOW_PLAYING_KEY);
	return parseNowPlaying(items[NOW_PLAYING_KEY]);
}

export function watchNowPlaying(listener: (nowPlaying: NowPlaying | null) => void): () => void {
	const onChanged = (changes: Record<string, unknown>, area: string) => {
		if (area !== 'local' || !(NOW_PLAYING_KEY in changes)) return;
		readNowPlaying().then(listener, () => {});
	};
	chrome.storage.onChanged.addListener(onChanged);
	return () => chrome.storage.onChanged.removeListener(onChanged);
}
