import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { sendDeletionCancelledEmail } from './emails';
import { users } from './schema';
import type { UserId } from './user-id';

/**
 * Called whenever a session starts. Signing in during the 30 days cancels a
 * pending deletion, however the person signed in.
 */
export async function cancelPendingDeletion(userId: UserId): Promise<boolean> {
	const [user] = await db
		.update(users)
		.set({ deletionRequestedAt: null })
		.where(and(eq(users.id, userId), isNotNull(users.deletionRequestedAt)))
		.returning({ email: users.email });
	if (!user) return false;

	await recordAuditEvent(userId, 'account_deletion_cancelled', userId);
	await sendDeletionCancelledEmail(user.email);
	return true;
}
