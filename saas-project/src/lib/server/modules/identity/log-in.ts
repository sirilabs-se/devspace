import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import { clearLoginFailures, lockoutSecondsLeft, recordLoginFailure } from './lockout';
import type { RequestContext } from './request-context';
import { limitRequests } from './request-limits';
import { users } from './schema';
import { applySessionCookies, type CookieJar } from './session';
import { toUserId } from './user-id';

/**
 * - "signed_in": the session has started.
 * - "invalid": the email and password didn't work. The same for an unknown
 *   email and a wrong password, so it never reveals who is registered. It is
 *   also the answer while an email is locked out after repeated failures, even
 *   for the right password, so a lockout looks like any other failure.
 * - "unverified": the password was right, but the email isn't verified yet.
 * - "rate_limited": too many login attempts from this network address.
 */
export type LogInResult =
	| { status: 'signed_in' }
	| { status: 'invalid' }
	| { status: 'unverified' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

const logInSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
	password: z.string().min(1).max(1000),
	rememberMe: z.boolean().default(false)
});

/** Signs a person in with their email and password. */
export async function logIn(
	input: unknown,
	cookies: CookieJar,
	context: RequestContext,
	now: number = Date.now()
): Promise<LogInResult> {
	const network = await limitRequests('login-by-ip', context.ipAddress, now);
	if (!network.allowed) {
		return { status: 'rate_limited', retryAfterSeconds: network.retryAfterSeconds };
	}

	const parsed = logInSchema.safeParse(input);
	if (!parsed.success) return { status: 'invalid' };
	const { email, password, rememberMe } = parsed.data;

	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
	const subject = user ? toUserId(user.id) : null;

	// Locked out: refuse without looking at the password. Attempts made during
	// the wait are not counted, so they can't be used to keep someone locked out.
	if ((await lockoutSecondsLeft(email, now)) > 0) {
		await recordAuditEvent(null, 'login_locked_out', subject, context);
		return { status: 'invalid' };
	}

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
			await clearLoginFailures(email);
			await recordAuditEvent(subject, 'login_unverified', subject, context);
			return { status: 'unverified' };
		}
		// Counted for unknown emails too, so a lockout never reveals who is registered.
		await recordLoginFailure(email, now);
		await recordAuditEvent(null, 'login_failed', subject, context);
		return { status: 'invalid' };
	}

	await clearLoginFailures(email);
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
