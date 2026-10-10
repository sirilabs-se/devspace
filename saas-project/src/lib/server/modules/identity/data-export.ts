import { asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { describeDevice } from './device';
import { assertNotImpersonating } from './impersonation';
import { consumeRateLimit, type RateLimitResult } from './rate-limit';
import type { RequestContext } from './request-context';
import {
	accounts,
	auditEvents,
	consents,
	passkeys,
	sessions,
	usernameHolds,
	users
} from './schema';
import type { SessionUser } from './session';
import type { UserId } from './user-id';

const EXPORTS_PER_HOUR = 5;

export type ConsentRecord = { document: string; version: string; acceptedAt: Date };

/** Which versions of the terms and privacy policy the acting user accepted, and when. */
export async function listConsents(userId: UserId): Promise<ConsentRecord[]> {
	return db
		.select({
			document: consents.document,
			version: consents.version,
			acceptedAt: consents.acceptedAt
		})
		.from(consents)
		.where(eq(consents.userId, userId))
		.orderBy(asc(consents.acceptedAt), asc(consents.id));
}

/**
 * Everything Identity holds about the acting user, in a form they can keep.
 * It is put together field by field, so nothing secret can slip in: no
 * password hash, session token, authenticator secret, backup code or passkey key.
 */
export async function exportMyData(
	user: SessionUser,
	context: RequestContext
): Promise<
	| { status: 'ready'; data: Record<string, unknown> }
	| (RateLimitResult & { status: 'rate_limited' })
> {
	assertNotImpersonating(user);

	const limit = await consumeRateLimit(`data-export:${user.id}`, EXPORTS_PER_HOUR, 60 * 60);
	if (!limit.allowed) return { status: 'rate_limited', ...limit };

	const [account] = await db.select().from(users).where(eq(users.id, user.id));
	if (!account) throw new Error('The acting user no longer exists');

	const signInAccounts = await db
		.select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
		.from(accounts)
		.where(eq(accounts.userId, user.id))
		.orderBy(asc(accounts.createdAt));
	const ownPasskeys = await db
		.select({ name: passkeys.name, createdAt: passkeys.createdAt, backedUp: passkeys.backedUp })
		.from(passkeys)
		.where(eq(passkeys.userId, user.id))
		.orderBy(asc(passkeys.createdAt));
	const ownSessions = await db
		.select({
			userAgent: sessions.userAgent,
			ipAddress: sessions.ipAddress,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt,
			expiresAt: sessions.expiresAt
		})
		.from(sessions)
		.where(eq(sessions.userId, user.id))
		.orderBy(desc(sessions.createdAt));
	const heldNames = await db
		.select({ username: usernameHolds.username, releaseAt: usernameHolds.releaseAt })
		.from(usernameHolds)
		.where(eq(usernameHolds.userId, user.id));
	const events = await db
		.select({
			action: auditEvents.action,
			createdAt: auditEvents.createdAt,
			ipAddress: auditEvents.ipAddress,
			userAgent: auditEvents.userAgent,
			details: auditEvents.details
		})
		.from(auditEvents)
		.where(eq(auditEvents.subjectUserId, user.id))
		.orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));

	const data = {
		about: 'Your personal data held by SaaS accounts. Times are in UTC.',
		exportedAt: new Date().toISOString(),
		profile: {
			id: account.id,
			name: account.name,
			email: account.email,
			emailVerified: account.emailVerified,
			username: account.displayUsername,
			picture: account.image,
			role: account.role,
			joinedAt: account.createdAt.toISOString(),
			suspended: account.banned,
			deletionRequestedAt: account.deletionRequestedAt?.toISOString() ?? null
		},
		preferences: {
			language: account.locale,
			timeZone: account.timeZone
		},
		signInMethods: {
			hasPassword: signInAccounts.some((entry) => entry.providerId === 'credential'),
			providers: signInAccounts
				.filter((entry) => entry.providerId !== 'credential')
				.map((entry) => ({
					provider: entry.providerId,
					connectedAt: entry.createdAt.toISOString()
				})),
			passkeys: ownPasskeys.map((entry) => ({
				name: entry.name,
				addedAt: entry.createdAt.toISOString(),
				syncedAcrossDevices: entry.backedUp
			})),
			twoStepVerification: account.twoFactorEnabled
		},
		sessions: ownSessions.map((entry) => ({
			device: describeDevice(entry.userAgent),
			browserDescription: entry.userAgent,
			networkAddress: entry.ipAddress,
			signedInAt: entry.createdAt.toISOString(),
			lastActiveAt: entry.updatedAt.toISOString(),
			expiresAt: entry.expiresAt.toISOString()
		})),
		consents: (await listConsents(user.id)).map((entry) => ({
			document: entry.document,
			version: entry.version,
			acceptedAt: entry.acceptedAt.toISOString()
		})),
		usernamesOnHold: heldNames.map((entry) => ({
			username: entry.username,
			heldUntil: entry.releaseAt?.toISOString() ?? null
		})),
		securityEvents: events.map((entry) => ({
			action: entry.action,
			at: entry.createdAt.toISOString(),
			device: describeDevice(entry.userAgent),
			browserDescription: entry.userAgent,
			networkAddress: entry.ipAddress,
			details: entry.details
		}))
	};

	await recordAuditEvent(user.id, 'data_exported', user.id, context);
	return { status: 'ready', data };
}
