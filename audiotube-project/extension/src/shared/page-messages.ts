import type { PlayState } from './storage/playback-tab';

const SOURCE = 'audiotube';

export type QualityMode = 'lowest' | 'normal';

/** What a tab's player can be told to do. */
export type PlayCommand = 'play' | 'pause';

/** Content script → page script. */
export type ContentToPage =
	| { type: 'quality/set'; mode: QualityMode }
	| { type: 'player/toggle-playback' }
	| { type: 'player/command'; command: PlayCommand }
	| { type: 'player/seek'; positionSec: number }
	| { type: 'player/set-volume'; level: number; muted: boolean };

/** The details of the video in a player. */
export interface PlayerVideoDetails {
	videoId: string;
	title: string;
	channel: string;
	/** Null for live streams and upcoming premieres. */
	durationSec: number | null;
	isLive: boolean;
}

/** What the page script reports about YouTube's main player. */
export type PlayerReport =
	| ({ type: 'player/video' } & PlayerVideoDetails)
	| { type: 'player/state'; state: PlayState; positionSec: number; rate: number }
	| { type: 'player/position'; positionSec: number }
	/** The main player's volume or mute changed (or is seen for the first time). */
	| { type: 'player/volume'; level: number; muted: boolean }
	/** The main player has been gone for a moment, for example after leaving the watch page without a mini-player. */
	| { type: 'player/gone'; positionSec: number };

/** Page script → content script. */
export type PageToContent = { type: 'quality/ready' } | PlayerReport;

type Envelope =
	| { source: typeof SOURCE; direction: 'to-page'; message: ContentToPage }
	| { source: typeof SOURCE; direction: 'to-content'; message: PageToContent };

function isEnvelope(data: unknown): data is Envelope {
	if (typeof data !== 'object' || data === null) return false;
	const { source, direction, message } = data as Partial<Envelope>;
	return (
		source === SOURCE &&
		(direction === 'to-page' || direction === 'to-content') &&
		typeof message === 'object' &&
		message !== null
	);
}

export function sendToPage(message: ContentToPage): void {
	window.postMessage({ source: SOURCE, direction: 'to-page', message } satisfies Envelope, '*');
}

export function sendToContent(message: PageToContent): void {
	window.postMessage({ source: SOURCE, direction: 'to-content', message } satisfies Envelope, '*');
}

function listen<T>(direction: Envelope['direction'], handler: (message: T) => void): () => void {
	const onMessage = (event: MessageEvent) => {
		if (event.source !== window || !isEnvelope(event.data) || event.data.direction !== direction)
			return;
		handler(event.data.message as T);
	};
	window.addEventListener('message', onMessage);
	return () => window.removeEventListener('message', onMessage);
}

export const onMessageToPage = (handler: (message: ContentToPage) => void) =>
	listen<ContentToPage>('to-page', handler);

export const onMessageToContent = (handler: (message: PageToContent) => void) =>
	listen<PageToContent>('to-content', handler);
