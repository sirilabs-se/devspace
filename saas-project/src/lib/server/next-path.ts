/**
 * Where to send someone after login: the page they were heading for, if it is
 * a plain path inside this app, otherwise the home page. Anything that could
 * lead to another site is ignored.
 */
export function safeNextPath(next: string | null | undefined): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
	if ([...next].some((character) => character.charCodeAt(0) < 32)) return '/';
	if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return '/';
	return next;
}
