import { APIError } from 'better-auth/api';
import { eq, like, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { deleteFile } from '$lib/server/storage';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth } from './auth';
import { listConnections } from './connections';
import { sendAccountDeletedEmail, sendDeletionScheduledEmail } from './emails';
import type { RequestContext } from './request-context';
import { auditEvents, rateLimits, sessions, usernameHolds, users, verifications } from './schema';
import {
	applySessionCookies,
	assertSessionBelongsTo,
	type CookieJar,
	type SessionUser
} from './session';
import { toUserId, type UserId } from './user-id';

/** A deleted account can be brought back by signing in within this many days. */
export const DELETION_GRACE_DAYS = 30;
/** Audit entries are kept this long. */
export const AUDIT_RETENTION_MONTHS = 12;
const DAY = 24 * 60 * 60 * 1000;

export type RequestDeletionResult =
	{ status: 'scheduled'; deleteAt: Date } | { status: 'current_password_wrong' | 'not_confirmed' };

/**
 * Starts deleting the acting user's account: every device is signed out, and
 * the account is removed for good after 30 days unless they sign in again.
 */
export async function requestAccountDeletion(
	user: SessionUser,
	headers: Headers,
	cookies: CookieJar,
	input: { currentPassword?: unknown; confirmed?: unknown },
	context: RequestContext,
	now: Date = new Date()
): Promise<RequestDeletionResult> {
	await assertSessionBelongsTo(user, headers);
	if (input.confirmed !== true) return { status: 'not_confirmed' };

	if ((await listConnections(user.id)).hasPassword) {
		const password = typeof input.currentPassword === 'string' ? input.currentPassword : '';
		try {
			await getAuth().api.verifyPassword({ headers, body: { password } });
		} catch (error) {
			if (!(error instanceof APIError)) throw error;
			await recordAuditEvent(user.id, 'account_deletion_refused', user.id, context);
			return { status: 'current_password_wrong' };
		}
	}

	const cleared = await getAuth().api.signOut({ headers, returnHeaders: true });
	applySessionCookies(cleared.headers, cookies);
	await db.transaction(async (tx) => {
		await tx.update(users).set({ deletionRequestedAt: now }).where(eq(users.id, user.id));
		await tx.delete(sessions).where(eq(sessions.userId, user.id));
		await recordAuditEvent(user.id, 'account_deletion_requested', user.id, {
			...context,
			database: tx
		});
	});

	const deleteAt = new Date(now.getTime() + DELETION_GRACE_DAYS * DAY);
	await sendDeletionScheduledEmail(user.email, deleteAt, appOrigin());
	return { status: 'scheduled', deleteAt };
}

type UserDeletedHandler = (userId: UserId) => Promise<void> | void;
const userDeletedHandlers: UserDeletedHandler[] = [];

/**
 * Lets another module clean up its own data when a user is permanently
 * deleted. The handler runs just before the user's own rows are removed.
 */
export function onUserDeleted(handler: UserDeletedHandler): void {
	userDeletedHandlers.push(handler);
}

const AVATAR_URL = /^\/files\/(avatars\/[0-9a-f-]{36}\.(jpg|png|webp))$/;

/** Removes a user and everything tied to them. There is no way back. */
async function deleteUserPermanently(userId: UserId): Promise<void> {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	if (!user) return;

	for (const handler of userDeletedHandlers) await handler(userId);

	await db.transaction(async (tx) => {
		if (user.username) {
			// Held for good, so nobody can pose as a former member.
			await tx
				.insert(usernameHolds)
				.values({ username: user.username, userId: null, releaseAt: null })
				.onConflictDoUpdate({
					target: usernameHolds.username,
					set: { userId: null, releaseAt: null }
				});
		}
		// The log keeps what happened, but no longer where from or on what device.
		await tx
			.update(auditEvents)
			.set({ ipAddress: null, userAgent: null })
			.where(or(eq(auditEvents.actorUserId, userId), eq(auditEvents.subjectUserId, userId)));
		// Outstanding links for this person: password resets and email-change undos.
		await tx
			.delete(verifications)
			.where(or(eq(verifications.value, userId), like(verifications.value, `%"${userId}"%`)));
		await recordAuditEvent(null, 'account_deleted', null, { database: tx });
		// Deleting the user removes their sign-in methods, sessions and consents with them,
		// and empties the user links in the audit log and in username holds.
		await tx.delete(users).where(eq(users.id, userId));
	});

	const avatar = user.image?.match(AVATAR_URL)?.[1];
	if (avatar) await deleteFile(avatar);
	await sendAccountDeletedEmail(user.email);
}

export type DailyJobResult = {
	accountsDeleted: number;
	usernameHoldsReleased: number;
	expiredLinksCleared: number;
	auditEntriesDeleted: number;
	countersCleared: number;
};

/** The once-a-day clean-up. Safe to run more often, or twice. */
export async function runDailyJob(now: Date = new Date()): Promise<DailyJobResult> {
	const due = await db
		.select({ id: users.id })
		.from(users)
		.where(lte(users.deletionRequestedAt, new Date(now.getTime() - DELETION_GRACE_DAYS * DAY)));
	for (const user of due) await deleteUserPermanently(toUserId(user.id));

	const holds = await db
		.delete(usernameHolds)
		.where(lte(usernameHolds.releaseAt, now))
		.returning({ id: usernameHolds.id });

	const links = await db
		.delete(verifications)
		.where(lt(verifications.expiresAt, now))
		.returning({ id: verifications.id });

	const cutoff = new Date(now);
	cutoff.setUTCMonth(cutoff.getUTCMonth() - AUDIT_RETENTION_MONTHS);
	// The database itself refuses to delete anything younger than this.
	const audit = await db
		.delete(auditEvents)
		.where(lt(auditEvents.createdAt, cutoff))
		.returning({ id: auditEvents.id });

	// Attempt counters that have not been touched for two days no longer limit anything.
	const counters = await db
		.delete(rateLimits)
		.where(lt(rateLimits.lastRequest, sql`${now.getTime() - 2 * DAY}`))
		.returning({ id: rateLimits.id });

	return {
		accountsDeleted: due.length,
		usernameHoldsReleased: holds.length,
		expiredLinksCleared: links.length,
		auditEntriesDeleted: audit.length,
		countersCleared: counters.length
	};
}
