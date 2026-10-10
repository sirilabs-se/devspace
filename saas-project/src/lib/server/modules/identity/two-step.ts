import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import { libraryHeaders } from './library-headers';
import type { RequestContext } from './request-context';
import { limitRequests } from './request-limits';
import { twoFactors, users } from './schema';
import {
	applySessionCookies,
	assertSessionBelongsTo,
	type CookieJar,
	type SessionUser
} from './session';
import { toUserId, type UserId } from './user-id';

// The optional second step after a password login: a 6-digit code from an
// authenticator app, or a single-use backup code.

/** Whether the acting user has the second step switched on. */
export async function isTwoStepOn(userId: UserId): Promise<boolean> {
	const [user] = await db
		.select({ on: users.twoFactorEnabled })
		.from(users)
		.where(eq(users.id, userId));
	return user?.on ?? false;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const wrongPassword = (error: unknown) => {
	if (error instanceof APIError) return true;
	throw error;
};

export type StartTwoStepSetupResult =
	| {
			status: 'started';
			/** What the QR code holds, for the authenticator app to scan. */
			totpUri: string;
			/** The same secret as text, for typing in by hand. */
			setupKey: string;
			/** Shown once. Each works once in place of a code. */
			backupCodes: string[];
	  }
	| { status: 'current_password_wrong' | 'already_on' };

/**
 * Starts setting up the second step. It is not switched on until the person
 * proves their authenticator app works, with `confirmTwoStepSetup`.
 */
export async function startTwoStepSetup(
	user: SessionUser,
	headers: Headers,
	password: unknown,
	context: RequestContext
): Promise<StartTwoStepSetupResult> {
	await assertSessionBelongsTo(user, headers);
	if (await isTwoStepOn(user.id)) return { status: 'already_on' };

	try {
		const result = await getAuth().api.enableTwoFactor({
			headers,
			body: { password: text(password) }
		});
		if (result.method !== 'totp') throw new Error('Expected an authenticator app set-up');
		return {
			status: 'started',
			totpUri: result.totpURI,
			setupKey: new URL(result.totpURI).searchParams.get('secret') ?? '',
			backupCodes: result.backupCodes
		};
	} catch (error) {
		wrongPassword(error);
		await recordAuditEvent(user.id, 'two_step_change_refused', user.id, context);
		return { status: 'current_password_wrong' };
	}
}

/** Switches the second step on, once the person enters a code from their authenticator app. */
export async function confirmTwoStepSetup(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	code: unknown,
	context: RequestContext
): Promise<{ status: 'on' | 'code_wrong' }> {
	await assertSessionBelongsTo(user, headers);

	try {
		const result = await getAuth().api.verifyTOTP({
			headers,
			body: { code: text(code).replace(/\s/g, '') },
			returnHeaders: true
		});
		applySessionCookies(result.headers, cookies);
	} catch (error) {
		if (error instanceof APIError) return { status: 'code_wrong' };
		throw error;
	}

	await recordAuditEvent(user.id, 'two_step_turned_on', user.id, context);
	return { status: 'on' };
}

/** Replaces the backup codes. The old ones stop working at once. */
export async function regenerateBackupCodes(
	user: SessionUser,
	headers: Headers,
	password: unknown,
	context: RequestContext
): Promise<
	{ status: 'done'; backupCodes: string[] } | { status: 'current_password_wrong' | 'not_on' }
> {
	await assertSessionBelongsTo(user, headers);
	if (!(await isTwoStepOn(user.id))) return { status: 'not_on' };

	try {
		const { backupCodes } = await getAuth().api.generateBackupCodes({
			headers,
			body: { password: text(password) }
		});
		await recordAuditEvent(user.id, 'backup_codes_regenerated', user.id, context);
		return { status: 'done', backupCodes };
	} catch (error) {
		wrongPassword(error);
		await recordAuditEvent(user.id, 'two_step_change_refused', user.id, context);
		return { status: 'current_password_wrong' };
	}
}

/** Switches the second step off and forgets the authenticator secret and backup codes. */
export async function turnOffTwoStep(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	password: unknown,
	context: RequestContext
): Promise<{ status: 'off' | 'current_password_wrong' | 'not_on' }> {
	await assertSessionBelongsTo(user, headers);
	if (!(await isTwoStepOn(user.id))) return { status: 'not_on' };

	try {
		const result = await getAuth().api.disableTwoFactor({
			headers,
			body: { password: text(password) },
			returnHeaders: true
		});
		applySessionCookies(result.headers, cookies);
	} catch (error) {
		wrongPassword(error);
		await recordAuditEvent(user.id, 'two_step_change_refused', user.id, context);
		return { status: 'current_password_wrong' };
	}

	await db.delete(twoFactors).where(eq(twoFactors.userId, user.id));
	await recordAuditEvent(user.id, 'two_step_turned_off', user.id, context);
	return { status: 'off' };
}

const CHALLENGE_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.two_factor=/;

/** True when the request is part-way through a login: the password was right and a code is owed. */
export function hasTwoStepChallenge(headers: Headers): boolean {
	return CHALLENGE_COOKIE.test(headers.get('cookie') ?? '');
}

export type CompleteTwoStepLoginResult =
	| { status: 'signed_in' }
	| { status: 'code_wrong' | 'no_challenge' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

export type TwoStepMethod = 'app' | 'email' | 'backup';

/** Emails a code to someone part-way through a login, as another way to complete the second step. */
export async function sendTwoStepEmailCode(
	headers: Headers,
	context: RequestContext
): Promise<
	{ status: 'sent' | 'no_challenge' } | { status: 'rate_limited'; retryAfterSeconds: number }
> {
	if (!hasTwoStepChallenge(headers)) return { status: 'no_challenge' };

	const limit = await limitRequests('two-step-email-by-ip', context.ipAddress);
	if (!limit.allowed) return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };

	try {
		await getAuth().api.sendTwoFactorOTP({ headers, body: {} });
	} catch (error) {
		// The wait for a code has run out.
		if (error instanceof APIError) return { status: 'no_challenge' };
		throw error;
	}
	return { status: 'sent' };
}

/**
 * Finishes a login that is waiting for its second step.
 *
 * @param method "app" for a 6-digit authenticator code, "email" for a code sent
 *   by email, "backup" for a backup code
 * @param trustDevice skip the second step on this browser for the next 30 days
 */
export async function completeTwoStepLogin(
	method: TwoStepMethod,
	code: unknown,
	headers: Headers,
	cookies: CookieJar,
	context: RequestContext,
	trustDevice: boolean = false
): Promise<CompleteTwoStepLoginResult> {
	if (!hasTwoStepChallenge(headers)) return { status: 'no_challenge' };

	const limit = await limitRequests('two-step-by-ip', context.ipAddress);
	if (!limit.allowed) return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };

	const cleaned = method === 'backup' ? text(code).trim() : text(code).replace(/\s/g, '');
	const body = { code: cleaned, trustDevice };
	// The session that starts here records the device and network address.
	const forLibrary = libraryHeaders(headers, context);
	let userId: UserId;
	try {
		const api = getAuth().api;
		const result =
			method === 'app'
				? await api.verifyTOTP({ headers: forLibrary, body, returnHeaders: true })
				: method === 'email'
					? await api.verifyTwoFactorOTP({ headers: forLibrary, body, returnHeaders: true })
					: await api.verifyBackupCode({ headers: forLibrary, body, returnHeaders: true });
		// The session cookie, and the "trusted device" cookie if that was asked for.
		applySessionCookies(result.headers, cookies);
		userId = toUserId(result.response.user.id);
	} catch (error) {
		if (!(error instanceof APIError)) throw error;
		await recordAuditEvent(null, 'two_step_failed', null, context);
		return { status: 'code_wrong' };
	}

	const secondStep = { app: 'authenticator', email: 'email_code', backup: 'backup_code' }[method];
	await recordAuditEvent(userId, 'login', userId, {
		...context,
		details: { method: 'password', secondStep, trustedDevice: trustDevice }
	});
	return { status: 'signed_in' };
}
