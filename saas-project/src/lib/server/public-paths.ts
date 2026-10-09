// Pages and endpoints that work without being signed in. Everything else
// requires a login, checked in hooks.server.ts. The list is in the system doc
// under "Cross-Cutting Concerns".
const PUBLIC_PATHS = new Set([
	'/',
	'/signup',
	'/verify-email',
	'/login',
	'/login/two-step',
	'/forgot-password',
	'/reset-password',
	'/api/username-available',
	'/api/jobs/daily'
]);

// Profile pictures are part of a person's public profile.
const PUBLIC_PREFIXES = ['/api/auth/', '/files/avatars/'];

export function isPublicPath(pathname: string): boolean {
	const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
	return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
