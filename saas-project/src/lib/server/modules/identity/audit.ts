import { db } from '$lib/server/db';
import type { RequestContext } from './request-context';
import { auditEvents, type AuditDetails } from './schema';
import type { UserId } from './user-id';

type Database = Pick<typeof db, 'insert'>;

export type AuditContext = Partial<RequestContext> & {
	/** Extra facts about the action. Never personal information, passwords or tokens. */
	details?: AuditDetails;
	/** Pass a transaction to save the entry together with other changes. */
	database?: Database;
};

/**
 * Appends an entry to the audit log.
 *
 * @param actor who did it, or null when nobody is signed in
 * @param action what happened, e.g. "signup"
 * @param target whose account it concerns, or null
 */
export async function recordAuditEvent(
	actor: UserId | null,
	action: string,
	target: UserId | null,
	context: AuditContext = {}
): Promise<void> {
	await (context.database ?? db).insert(auditEvents).values({
		actorUserId: actor,
		subjectUserId: target,
		action,
		details: context.details ?? null,
		ipAddress: context.ipAddress ?? null,
		userAgent: context.userAgent ?? null
	});
}
