const SOURCE = 'audiotube';

/** Content script → page script. */
export type ContentToPage = { type: 'quality/set'; mode: 'lowest' | 'normal' };

/** Page script → content script. */
export type PageToContent = { type: 'quality/ready' };

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
