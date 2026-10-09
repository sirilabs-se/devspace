import { error } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { getAuth } from './auth';
import { toUserId, type UserId } from './user-id';

/** The signed-in person, as the rest of the app sees them. */
export type SessionUser = {
	id: UserId;
	name: string;
	email: string;
	username: string | null;
	emailVerified: boolean;
};

/** Somewhere to put cookies. SvelteKit's `event.cookies` fits. */
export type CookieJar = {
	set(
		name: string,
		value: string,
		options: {
			path: string;
			maxAge?: number;
			expires?: Date;
			domain?: string;
			secure?: boolean;
			httpOnly?: boolean;
			sameSite?: 'strict' | 'lax' | 'none';
		}
	): void;
};

/** Copies the cookies the login library wants set (the session cookie) into the jar. */
export function applySessionCookies(headers: Headers, cookies: CookieJar): boolean {
	const header = headers.get('set-cookie');
	if (!header) return false;

	for (const [name, attributes] of parseSetCookieHeader(header)) {
		const options = toCookieOptions(attributes);
		cookies.set(name, attributes.value, {
			path: options.path ?? '/',
			maxAge: options.maxAge,
			expires: options.expires,
			domain: options.domain,
			secure: options.secure,
			httpOnly: options.httpOnly,
			sameSite: options.sameSite?.toLowerCase() as 'strict' | 'lax' | 'none' | undefined
		});
	}
	return true;
}

/**
 * Finds who is signed in from the request's cookies, or null if nobody is.
 * This is the only source of the acting user: nothing else in a request can choose it.
 */
export async function getSessionUser(
	headers: Headers,
	cookies?: CookieJar
): Promise<SessionUser | null> {
	const { headers: responseHeaders, response } = await getAuth().api.getSession({
		headers,
		returnHeaders: true
	});
	// The library renews the session cookie as it gets close to expiring.
	if (cookies) applySessionCookies(responseHeaders, cookies);
	if (!response) return null;

	const { user } = response;
	return {
		id: toUserId(user.id),
		name: user.name,
		email: user.email,
		username: user.username ?? null,
		emailVerified: user.emailVerified
	};
}

/** Returns the signed-in user, or stops the request if nobody is signed in. */
export function requireUser(locals: { user: SessionUser | null }): SessionUser {
	if (!locals.user) error(401, { message: 'Sign in to continue' });
	return locals.user;
}
