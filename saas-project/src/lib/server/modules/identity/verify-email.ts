import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import { emailChanged } from './change-email';
import { libraryHeaders } from './library-headers';
import { linkTokenPayload } from './link-token';
import { consumeRateLimit, rateLimitKey } from './rate-limit';
import type { RequestContext } from './request-context';
import { users } from './schema';
import { applySessionCookies, type CookieJar } from './session';
import { toUserId } from './user-id';

const RESENDS_PER_HOUR = 3;
const ONE_HOUR_IN_SECONDS = 60 * 60;

/**
 * - "verified": the email is now confirmed and the person is signed in.
 * - "expired": the link is older than 24 hours.
 * - "invalid": the link is malformed, or was already used.
 */
export type VerifyEmailResult =
	{ status: 'verified' } | { status: 'expired' } | { status: 'invalid' };

/** Confirms an email address from the link in the verification email, and signs the person in. */
export async function verifyEmail(
	token: unknown,
	cookies: CookieJar,
	context: RequestContext
): Promise<VerifyEmailResult> {
	if (typeof token !== 'string' || token === '') return { status: 'invalid' };

	let responseHeaders: Headers;
	try {
		const result = await getAuth().api.verifyEmail({
			query: { token },
			headers: libraryHeaders(undefined, context),
			returnHeaders: true
		});
		responseHeaders = result.headers;
	} catch (error) {
		if (error instanceof APIError) {
			return { status: error.body?.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid' };
		}
		throw error;
	}

	// The library starts a session only when it has just verified the address.
	// A link for an address that is already verified signs nobody in: links work once.
	if (!applySessionCookies(responseHeaders, cookies)) return { status: 'invalid' };

	// The library has checked the token by now, so what it says can be relied on.
	const payload = linkTokenPayload(token);
	const currentEmail = payload?.updateTo ?? payload?.email;
	if (currentEmail) {
		const [user] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, currentEmail));
		if (user && payload?.updateTo && payload.email) {
			// This link confirmed a change of email, which has now taken effect.
			await emailChanged(toUserId(user.id), payload.email, context);
		} else if (user) {
			await recordAuditEvent(toUserId(user.id), 'email_verified', toUserId(user.id), context);
		}
	}

	return { status: 'verified' };
}

export type ResendVerificationResult =
	| { status: 'sent' }
	| { status: 'throttled'; retryAfterSeconds: number }
	| { status: 'invalid_email' };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/**
 * Sends the verification email again, at most 3 times per hour for one address.
 *
 * The answer is the same whether or not the address has an account, so it
 * never reveals who is registered.
 */
export async function resendVerificationEmail(
	email: unknown,
	context: RequestContext
): Promise<ResendVerificationResult> {
	const parsed = emailSchema.safeParse(email);
	if (!parsed.success) return { status: 'invalid_email' };

	const limit = await consumeRateLimit(
		rateLimitKey('verify-resend', parsed.data),
		RESENDS_PER_HOUR,
		ONE_HOUR_IN_SECONDS
	);
	if (!limit.allowed) return { status: 'throttled', retryAfterSeconds: limit.retryAfterSeconds };

	const [user] = await db
		.select({ id: users.id, emailVerified: users.emailVerified })
		.from(users)
		.where(eq(users.email, parsed.data));

	// The library sends nothing for an unknown or already verified address.
	await getAuth().api.sendVerificationEmail({ body: { email: parsed.data } });

	if (user && !user.emailVerified) {
		await recordAuditEvent(null, 'verification_email_resent', toUserId(user.id), context);
	}

	return { status: 'sent' };
}
