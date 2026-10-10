import { PLAYER_SELECTOR } from '../shared';

export function isWatchPath(pathname: string): boolean {
	return pathname === '/watch' || pathname.startsWith('/live/');
}

export function findPlayer(doc: Document): HTMLElement | null {
	return doc.querySelector<HTMLElement>(PLAYER_SELECTOR);
}

/** True while YouTube shows its own small player in the corner, which is the player element moved into it. */
export function isInMiniPlayer(player: HTMLElement): boolean {
	return player.closest('ytd-miniplayer') !== null && player.getBoundingClientRect().width > 0;
}

/** The player to cover: the watch page's, or the mini-player when YouTube shows it on any other page. */
export function findPlayerToCover(doc: Document, pathname: string): HTMLElement | null {
	const player = findPlayer(doc);
	if (!player) return null;
	return isWatchPath(pathname) || isInMiniPlayer(player) ? player : null;
}
