import { assertNotImpersonating } from './impersonation';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth } from './auth';
import { sendPasswordChangedEmail } from './emails';
import { passwordProblem } from './password';
import { passwordGuessWaitSeconds, recordWrongPasswordGuess } from './password-guess';
import type { RequestContext } from './request-context';
import {
	applySessionCookies,
	assertSessionBelongsTo,
	type CookieJar,
	type SessionUser
} from './session';

export type ChangePasswordResult =
	| { status: 'done' }
	| { status: 'current_password_wrong' }
	| { status: 'password_too_weak' | 'password_too_long' | 'passwords_differ' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

const changeSchema = z.object({
	currentPassword: z.string().min(1).max(1000),
	password: z.string(),
	confirmPassword: z.string()
});

/**
 * Changes the signed-in person's password. They must give their current one.
 * Every other session of theirs is ended; this one carries on.
 *
 * @param user the acting user, from `event.locals`
 * @param headers the request's headers, which carry their session
 */
export async function changePassword(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	input: unknown,
	context: RequestContext
): Promise<ChangePasswordResult> {
	await assertSessionBelongsTo(user, headers);
	assertNotImpersonating(user);

	const parsed = changeSchema.safeParse(input);
	if (!parsed.success) return { status: 'current_password_wrong' };
	const { currentPassword, password, confirmPassword } = parsed.data;

	const problem = passwordProblem(password);
	if (problem) return { status: `password_${problem}` };
	if (password !== confirmPassword) return { status: 'passwords_differ' };

	// After too many wrong guesses even the right password is refused for a while.
	const wait = await passwordGuessWaitSeconds(user.id);
	if (wait > 0) return { status: 'rate_limited', retryAfterSeconds: wait };

	try {
		const result = await getAuth().api.changePassword({
			headers,
			body: { currentPassword, newPassword: password, revokeOtherSessions: true },
			returnHeaders: true
		});
		// Ending the other sessions gives this one a fresh cookie.
		applySessionCookies(result.headers, cookies);
	} catch (error) {
		if (!(error instanceof APIError)) throw error;

		await recordWrongPasswordGuess(user.id);
		await recordAuditEvent(user.id, 'password_change_failed', user.id, context);
		return { status: 'current_password_wrong' };
	}

	await recordAuditEvent(user.id, 'password_changed', user.id, context);
	await sendPasswordChangedEmail(user.email, appOrigin());
	return { status: 'done' };
}

/** Ends every session of the signed-in person, including the current one. */
export async function signOutEverywhere(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	context: RequestContext
): Promise<void> {
	await assertSessionBelongsTo(user, headers);
	// It would sign the real person out of their own devices.
	assertNotImpersonating(user);

	await getAuth().api.revokeSessions({ headers });
	// The session is gone; this clears its cookie from the browser.
	const cleared = await getAuth().api.signOut({ headers, returnHeaders: true });
	applySessionCookies(cleared.headers, cookies);

	await recordAuditEvent(user.id, 'signed_out_everywhere', user.id, context);
}
