export function isWatchPath(pathname: string): boolean {
	return pathname === '/watch' || pathname.startsWith('/live/');
}

export function findPlayer(doc: Document): HTMLElement | null {
	return doc.querySelector<HTMLElement>('ytd-watch-flexy #movie_player, #movie_player');
}
