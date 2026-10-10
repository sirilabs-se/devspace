import { PLAYER_SELECTOR } from '../shared';

export function isWatchPath(pathname: string): boolean {
	return pathname === '/watch' || pathname.startsWith('/live/');
}

export function findPlayer(doc: Document): HTMLElement | null {
	return doc.querySelector<HTMLElement>(PLAYER_SELECTOR);
}
