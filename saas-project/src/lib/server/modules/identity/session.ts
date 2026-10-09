import { error } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { getAuth, SESSION_MAX_AGE_SECONDS } from './auth';
import { consents } from './schema';
import { toUserId, type UserId } from './user-id';

/** The signed-in person, as the rest of the app sees them. */
export type SessionUser = {
	id: UserId;
	name: string;
	email: string;
	username: string | null;
	emailVerified: boolean;
	image: string | null;
	/**
	 * True for someone who signed in with Google or Facebook and hasn't yet accepted
	 * the terms and confirmed their age. Until they do, they can only reach `/welcome`.
	 */
	welcomePending: boolean;
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

	const { user, session } = response;
	// Renewal keeps a session alive while it is used, but never past its maximum age.
	if (Date.now() - new Date(session.createdAt).getTime() > SESSION_MAX_AGE_SECONDS * 1000) {
		const ended = await getAuth().api.signOut({ headers, returnHeaders: true });
		if (cookies) applySessionCookies(ended.headers, cookies);
		return null;
	}

	const [accepted] = await db
		.select({ id: consents.id })
		.from(consents)
		.where(and(eq(consents.userId, user.id), eq(consents.document, 'terms')))
		.limit(1);

	return {
		id: toUserId(user.id),
		name: user.name,
		email: user.email,
		username: user.username ?? null,
		emailVerified: user.emailVerified,
		image: user.image ?? null,
		welcomePending: !accepted
	};
}

/**
 * Stops with an error unless the request's session belongs to this user.
 * Functions that act through the session call it first, so the user they are
 * told is acting and the session they act on can never be two different people.
 */
export async function assertSessionBelongsTo(user: SessionUser, headers: Headers): Promise<void> {
	const current = await getAuth().api.getSession({ headers });
	if (current?.user.id !== user.id) {
		throw new Error('The session does not belong to the acting user');
	}
}

/** Returns the signed-in user, or stops the request if nobody is signed in. */
export function requireUser(locals: { user: SessionUser | null }): SessionUser {
	if (!locals.user) error(401, { message: 'Sign in to continue' });
	return locals.user;
}
