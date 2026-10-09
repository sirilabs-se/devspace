import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import type { RequestContext } from './request-context';
import { users } from './schema';
import { applySessionCookies, type CookieJar } from './session';
import { toUserId } from './user-id';

/**
 * - "signed_in": the session has started.
 * - "invalid": the email and password didn't work. The same for an unknown
 *   email and a wrong password, so it never reveals who is registered.
 * - "unverified": the password was right, but the email isn't verified yet.
 */
export type LogInResult =
	{ status: 'signed_in' } | { status: 'invalid' } | { status: 'unverified' };

const logInSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
	password: z.string().min(1).max(1000),
	rememberMe: z.boolean().default(false)
});

/** Signs a person in with their email and password. */
export async function logIn(
	input: unknown,
	cookies: CookieJar,
	context: RequestContext
): Promise<LogInResult> {
	const parsed = logInSchema.safeParse(input);
	if (!parsed.success) return { status: 'invalid' };
	const { email, password, rememberMe } = parsed.data;

	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
	const subject = user ? toUserId(user.id) : null;

	try {
		const { headers } = await getAuth().api.signInEmail({
			body: { email, password, rememberMe },
			returnHeaders: true
		});
		applySessionCookies(headers, cookies);
	} catch (error) {
		if (!(error instanceof APIError)) throw error;

		// The library checks the password before it reports an unverified email.
		if (error.body?.code === 'EMAIL_NOT_VERIFIED') {
			await recordAuditEvent(subject, 'login_unverified', subject, context);
			return { status: 'unverified' };
		}
		await recordAuditEvent(null, 'login_failed', subject, context);
		return { status: 'invalid' };
	}

	await recordAuditEvent(subject, 'login', subject, {
		...context,
		details: { method: 'password', rememberMe }
	});
	return { status: 'signed_in' };
}

/** Ends the current session. */
export async function logOut(
	headers: Headers,
	cookies: CookieJar,
	context: RequestContext
): Promise<void> {
	const current = await getAuth().api.getSession({ headers });

	const ended = await getAuth().api.signOut({ headers, returnHeaders: true });
	applySessionCookies(ended.headers, cookies);

	if (current) {
		const userId = toUserId(current.user.id);
		await recordAuditEvent(userId, 'logout', userId, context);
	}
}
