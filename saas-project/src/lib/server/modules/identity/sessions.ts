import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { getAuth } from './auth';
import { describeDevice } from './device';
import type { RequestContext } from './request-context';
import { sessions } from './schema';
import { assertSessionBelongsTo, type SessionUser } from './session';

export type ActiveSession = {
	id: string;
	/** A few plain words, e.g. "Chrome on Windows". */
	device: string;
	ipAddress: string | null;
	signedInAt: Date;
	/** When the session was last renewed. Sessions renew about once a day while in use. */
	lastActiveAt: Date;
	/** True for the session making this request. */
	current: boolean;
};

/** Where the acting user is signed in: this session first, then the most recently used. */
export async function listActiveSessions(
	user: SessionUser,
	headers: Headers,
	now: Date = new Date()
): Promise<ActiveSession[]> {
	const current = await getAuth().api.getSession({ headers });
	if (current?.user.id !== user.id)
		throw new Error('The session does not belong to the acting user');

	const rows = await db
		.select({
			id: sessions.id,
			userAgent: sessions.userAgent,
			ipAddress: sessions.ipAddress,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt
		})
		.from(sessions)
		.where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now)))
		.orderBy(desc(sessions.updatedAt));

	return rows
		.map((row) => ({
			id: row.id,
			device: describeDevice(row.userAgent),
			ipAddress: row.ipAddress,
			signedInAt: row.createdAt,
			lastActiveAt: row.updatedAt,
			current: row.id === current.session.id
		}))
		.sort((a, b) => Number(b.current) - Number(a.current));
}

export type EndSessionResult = { status: 'ended' | 'not_found' | 'is_current' };

/**
 * Ends one of the acting user's other sessions, signing that browser out.
 * The session making the request is ended by logging out instead.
 */
export async function endSession(
	user: SessionUser,
	headers: Headers,
	sessionId: unknown,
	context: RequestContext
): Promise<EndSessionResult> {
	await assertSessionBelongsTo(user, headers);
	if (typeof sessionId !== 'string') return { status: 'not_found' };

	const current = await getAuth().api.getSession({ headers });
	if (current?.session.id === sessionId) return { status: 'is_current' };

	const ended = await db
		.delete(sessions)
		// The user ID is part of the condition, so only their own session can be ended.
		.where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
		.returning({ id: sessions.id });
	if (ended.length === 0) return { status: 'not_found' };

	await recordAuditEvent(user.id, 'session_ended', user.id, context);
	return { status: 'ended' };
}
