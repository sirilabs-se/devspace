import { findMainPlayer, isInMiniPlayer, isWatchPath, PLAYER_SELECTOR } from '../shared';

export { isInMiniPlayer, isWatchPath };

export function findPlayer(doc: Document): HTMLElement | null {
	return doc.querySelector<HTMLElement>(PLAYER_SELECTOR);
}

/** The player to cover: the watch page's, or the mini-player when YouTube shows it on any other page. */
export const findPlayerToCover = findMainPlayer;
