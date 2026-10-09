import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { describeDevice } from './device';
import { auditEvents } from './schema';
import type { UserId } from './user-id';

export type SecurityActivity = {
	/** What happened, e.g. "login" or "password_changed". */
	action: string;
	at: Date;
	/** A few plain words, e.g. "Chrome on Windows". */
	device: string;
	ipAddress: string | null;
	/** True when the person did it themselves while signed in; false for attempts by anyone. */
	bySelf: boolean;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * The acting user's own recent security events, newest first: logins, failed
 * logins, password and email changes and the like. Nobody else's are reachable.
 */
export async function listSecurityActivity(
	userId: UserId,
	limit: number = DEFAULT_LIMIT
): Promise<SecurityActivity[]> {
	const rows = await db
		.select({
			action: auditEvents.action,
			at: auditEvents.createdAt,
			userAgent: auditEvents.userAgent,
			ipAddress: auditEvents.ipAddress,
			actorUserId: auditEvents.actorUserId
		})
		.from(auditEvents)
		.where(eq(auditEvents.subjectUserId, userId))
		.orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
		.limit(Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT));

	return rows.map((row) => ({
		action: row.action,
		at: row.at,
		device: describeDevice(row.userAgent),
		ipAddress: row.ipAddress,
		bySelf: row.actorUserId === userId
	}));
}
