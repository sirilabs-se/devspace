import type { Cookies } from '@sveltejs/kit';

// Remembers, between sign-up and the "check your inbox" page, which address
// the verification email went to, so it never has to appear in a URL.
const COOKIE = 'pending_email';
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export function rememberPendingEmail(cookies: Cookies, email: string): void {
	cookies.set(COOKIE, email, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: ONE_DAY_IN_SECONDS
	});
}

export function pendingEmail(cookies: Cookies): string | null {
	return cookies.get(COOKIE) || null;
}

export function forgetPendingEmail(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}
