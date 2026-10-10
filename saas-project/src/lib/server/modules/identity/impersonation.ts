import { error } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import { sendImpersonationNoticeEmail } from './emails';
import type { RequestContext } from './request-context';
import { users } from './schema';
import {
	applySessionCookies,
	assertSessionBelongsTo,
	requireRole,
	type CookieJar,
	type SessionUser
} from './session';
import { toUserId } from './user-id';

// An admin "logging in as" a user to see what they see. Every use is recorded
// and the user is told by email. It lasts at most an hour.

/**
 * Stops the request if this session is an admin impersonating the user.
 * Called by everything an impersonating admin must not do: changing the
 * password, email or sign-in methods, and deleting the account.
 */
export function assertNotImpersonating(user: SessionUser): void {
	if (user.impersonatedBy) {
		error(403, { message: 'This can’t be done while viewing the app as another person' });
	}
}

export type StartImpersonationResult = {
	status: 'started' | 'not_found' | 'is_self' | 'is_admin' | 'already_impersonating';
};

/** Switches the admin's browser to a session as the user. Admins only; never another admin. */
export async function startImpersonation(
	admin: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	userId: unknown,
	context: RequestContext
): Promise<StartImpersonationResult> {
	requireRole(admin, 'admin');
	await assertSessionBelongsTo(admin, headers);
	if (admin.impersonatedBy) return { status: 'already_impersonating' };
	if (typeof userId !== 'string') return { status: 'not_found' };
	if (userId === admin.id) return { status: 'is_self' };

	const [target] = await db
		.select({ id: users.id, email: users.email, role: users.role })
		.from(users)
		.where(eq(users.id, userId));
	if (!target) return { status: 'not_found' };
	if (target.role === 'admin') return { status: 'is_admin' };

	try {
		const result = await getAuth().api.impersonateUser({
			headers,
			body: { userId: target.id },
			returnHeaders: true
		});
		// The admin's own session is set aside in a signed cookie, to return to.
		applySessionCookies(result.headers, cookies);
	} catch (thrown) {
		// The library refuses too, for example for a suspended user.
		if (thrown instanceof APIError) return { status: 'not_found' };
		throw thrown;
	}

	const subject = toUserId(target.id);
	await recordAuditEvent(admin.id, 'impersonation_started', subject, context);
	await sendImpersonationNoticeEmail(target.email);
	return { status: 'started' };
}

/** Ends the impersonation and returns the browser to the admin's own session. */
export async function stopImpersonation(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	context: RequestContext
): Promise<{ status: 'stopped' | 'not_impersonating' }> {
	if (!user.impersonatedBy) return { status: 'not_impersonating' };
	await assertSessionBelongsTo(user, headers);

	const result = await getAuth().api.stopImpersonating({ headers, returnHeaders: true });
	applySessionCookies(result.headers, cookies);

	await recordAuditEvent(user.impersonatedBy, 'impersonation_stopped', user.id, context);
	return { status: 'stopped' };
}
