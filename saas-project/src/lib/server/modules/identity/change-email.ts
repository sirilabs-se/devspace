import { createHash, randomBytes } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth } from './auth';
import { listConnections } from './connections';
import { sendEmailChangedNotice, sendEmailChangeUndoneEmail } from './emails';
import type { RequestContext } from './request-context';
import { limitRequests } from './request-limits';
import { sessions, users, verifications } from './schema';
import { assertSessionBelongsTo, type SessionUser } from './session';
import { toUserId, type UserId } from './user-id';

/** After a change of email, the old address can undo it for this many days. */
export const EMAIL_CHANGE_UNDO_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type RequestEmailChangeResult =
	| { status: 'sent' }
	| { status: 'invalid_email' | 'same_email' | 'current_password_wrong' }
	| { status: 'rate_limited'; retryAfterSeconds: number };

const changeSchema = z.object({
	newEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)),
	currentPassword: z.string().optional()
});

/**
 * Starts a change of email for the acting user. Nothing changes until the link
 * sent to the new address is opened. Someone with a password must give it.
 *
 * The answer is "sent" even if the new address already has an account, so it
 * never reveals who is registered. In that case no email is sent.
 */
export async function requestEmailChange(
	user: SessionUser,
	headers: Headers,
	input: unknown,
	context: RequestContext
): Promise<RequestEmailChangeResult> {
	await assertSessionBelongsTo(user, headers);

	const parsed = changeSchema.safeParse(input);
	if (!parsed.success) return { status: 'invalid_email' };
	const { newEmail, currentPassword } = parsed.data;
	if (newEmail === user.email) return { status: 'same_email' };

	const limit = await limitRequests('email-change-by-user', user.id);
	if (!limit.allowed) return { status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };

	if ((await listConnections(user.id)).hasPassword) {
		try {
			await getAuth().api.verifyPassword({ headers, body: { password: currentPassword ?? '' } });
		} catch (error) {
			if (!(error instanceof APIError)) throw error;
			await recordAuditEvent(user.id, 'email_change_refused', user.id, context);
			return { status: 'current_password_wrong' };
		}
	}

	await getAuth().api.changeEmail({ headers, body: { newEmail } });
	await recordAuditEvent(user.id, 'email_change_requested', user.id, context);
	return { status: 'sent' };
}

const undoIdentifier = (token: string) =>
	`email-change-undo:${createHash('sha256').update(token).digest('hex')}`;

/**
 * Called once a change of email has taken effect: records it, and tells the
 * old address, with a link to undo it.
 */
export async function emailChanged(
	userId: UserId,
	oldEmail: string,
	context: RequestContext,
	now: Date = new Date()
): Promise<void> {
	const token = randomBytes(32).toString('hex');
	await db.insert(verifications).values({
		id: randomBytes(16).toString('hex'),
		// Only a scrambled form of the token is stored, so the table alone can't undo anything.
		identifier: undoIdentifier(token),
		value: JSON.stringify({ userId, oldEmail }),
		expiresAt: new Date(now.getTime() + EMAIL_CHANGE_UNDO_DAYS * DAY)
	});

	await recordAuditEvent(userId, 'email_changed', userId, context);
	await sendEmailChangedNotice(
		oldEmail,
		`${appOrigin()}/undo-email-change?token=${token}`,
		EMAIL_CHANGE_UNDO_DAYS
	);
}

async function findUndo(token: unknown, now: Date) {
	if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
	const [row] = await db
		.select()
		.from(verifications)
		.where(eq(verifications.identifier, undoIdentifier(token)));
	if (!row || row.expiresAt < now) return null;

	const { userId, oldEmail } = JSON.parse(row.value) as { userId: string; oldEmail: string };
	return { rowId: row.id, userId: toUserId(userId), oldEmail };
}

/** Says whether an undo link can still be used, before the confirmation page is shown. */
export async function canUndoEmailChange(token: unknown, now: Date = new Date()): Promise<boolean> {
	return (await findUndo(token, now)) !== null;
}

/**
 * - "undone": the old address signs in again and every device was signed out.
 * - "invalid": the link is malformed, already used, or older than 7 days.
 * - "unavailable": the old address has since been taken by another account.
 */
export type UndoEmailChangeResult = { status: 'undone' | 'invalid' | 'unavailable' };

/** Puts the old email address back. Works once, within 7 days of the change. */
export async function undoEmailChange(
	token: unknown,
	context: RequestContext,
	now: Date = new Date()
): Promise<UndoEmailChangeResult> {
	const undo = await findUndo(token, now);
	if (!undo) return { status: 'invalid' };

	const [taken] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, undo.oldEmail));
	if (taken && taken.id !== undo.userId) return { status: 'unavailable' };

	await db.transaction(async (tx) => {
		await tx
			.update(users)
			.set({ email: undo.oldEmail, emailVerified: true })
			.where(eq(users.id, undo.userId));
		// Whoever changed the email may still be signed in somewhere.
		await tx.delete(sessions).where(eq(sessions.userId, undo.userId));
		await tx.delete(verifications).where(eq(verifications.id, undo.rowId));
		await recordAuditEvent(null, 'email_change_undone', undo.userId, { ...context, database: tx });
	});

	await sendEmailChangeUndoneEmail(undo.oldEmail, appOrigin());
	return { status: 'undone' };
}
