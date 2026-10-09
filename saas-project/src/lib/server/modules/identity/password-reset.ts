import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth } from './auth';
import { sendPasswordChangedEmail } from './emails';
import { clearLoginFailures } from './lockout';
import { passwordProblem } from './password';
import type { RequestContext } from './request-context';
import { limitRequests } from './request-limits';
import { users, verifications } from './schema';
import { toUserId } from './user-id';

export type RequestPasswordResetResult =
	| { status: 'sent' }
	| { status: 'invalid_email' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/**
 * Emails a reset link if the address has an account. The answer is "sent"
 * either way, so it never reveals who is registered.
 */
export async function requestPasswordReset(
	email: unknown,
	context: RequestContext
): Promise<RequestPasswordResetResult> {
	const parsed = emailSchema.safeParse(email);
	if (!parsed.success) return { status: 'invalid_email' };

	for (const limit of [
		await limitRequests('password-reset-by-ip', context.ipAddress),
		await limitRequests('password-reset-by-email', parsed.data)
	]) {
		if (!limit.allowed) {
			return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };
		}
	}

	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data));

	// The library does nothing for an address with no account.
	await getAuth().api.requestPasswordReset({ body: { email: parsed.data } });

	if (user) {
		await recordAuditEvent(null, 'password_reset_requested', toUserId(user.id), context);
	}
	return { status: 'sent' };
}

/** "invalid" covers a malformed link and one that was already used. */
export type ResetLinkState = 'valid' | 'expired' | 'invalid';

async function findResetLink(token: unknown) {
	if (typeof token !== 'string' || token === '') return null;
	const [link] = await db
		.select({ userId: verifications.value, expiresAt: verifications.expiresAt })
		.from(verifications)
		.where(eq(verifications.identifier, `reset-password:${token}`));
	return link ?? null;
}

/** Says whether a reset link can still be used, before the form is shown. */
export async function resetPasswordLinkState(token: unknown): Promise<ResetLinkState> {
	const link = await findResetLink(token);
	if (!link) return 'invalid';
	return link.expiresAt < new Date() ? 'expired' : 'valid';
}

export type ResetPasswordResult =
	| { status: 'done' }
	| { status: 'password_too_weak' | 'password_too_long' | 'passwords_differ' }
	| { status: 'expired' | 'invalid' };

const resetSchema = z.object({
	token: z.string().min(1),
	password: z.string(),
	confirmPassword: z.string()
});

/**
 * Sets a new password from a reset link. The link works once. Every session
 * of the account is ended, and any login lockout is cleared.
 */
export async function resetPassword(
	input: unknown,
	context: RequestContext
): Promise<ResetPasswordResult> {
	const parsed = resetSchema.safeParse(input);
	if (!parsed.success) return { status: 'invalid' };
	const { token, password, confirmPassword } = parsed.data;

	const link = await findResetLink(token);
	if (!link) return { status: 'invalid' };
	if (link.expiresAt < new Date()) return { status: 'expired' };

	const problem = passwordProblem(password);
	if (problem) return { status: `password_${problem}` };
	if (password !== confirmPassword) return { status: 'passwords_differ' };

	try {
		await getAuth().api.resetPassword({ body: { token, newPassword: password } });
	} catch (error) {
		// Used by another request between the check above and now.
		if (error instanceof APIError) return { status: 'invalid' };
		throw error;
	}

	const [user] = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.id, link.userId));
	if (user) {
		await clearLoginFailures(user.email);
		await recordAuditEvent(toUserId(user.id), 'password_reset', toUserId(user.id), context);
		await sendPasswordChangedEmail(user.email, appOrigin());
	}
	return { status: 'done' };
}
