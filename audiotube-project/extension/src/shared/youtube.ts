/** The element that holds YouTube's main player. */
export const PLAYER_SELECTOR = 'ytd-watch-flexy #movie_player, #movie_player';

export function isWatchPath(pathname: string): boolean {
	return pathname === '/watch' || pathname.startsWith('/live/');
}

/** True while YouTube shows its own small player in the corner, which is the player element moved into it. */
export function isInMiniPlayer(player: HTMLElement): boolean {
	return player.closest('ytd-miniplayer') !== null && player.getBoundingClientRect().width > 0;
}

/**
 * The main player: `#movie_player` on a watch page, or inside YouTube's mini-player on any other page.
 * The element can still be in the DOM at 0 x 0 on other pages, and the embed page has its own; those are not it.
 */
export function findMainPlayer(doc: Document, pathname: string): HTMLElement | null {
	const player = doc.querySelector<HTMLElement>(PLAYER_SELECTOR);
	if (!player) return null;
	return isWatchPath(pathname) || isInMiniPlayer(player) ? player : null;
}
