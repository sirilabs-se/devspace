import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { signInMethodCount } from './connections';
import type { RequestContext } from './request-context';
import { passkeys } from './schema';
import { assertNotImpersonating } from './impersonation';
import type { SessionUser } from './session';
import type { UserId } from './user-id';

// Adding a passkey, and signing in with one, is an exchange between the
// browser and the login library at /api/auth/passkey/*. This file is the rest:
// listing, naming and removing them.

const NAME_MAX_LENGTH = 60;

export type PasskeySummary = {
	id: string;
	name: string | null;
	createdAt: Date;
	/** True when the passkey is synced between the person's devices by its provider. */
	syncedAcrossDevices: boolean;
};

/** The acting user's own passkeys, oldest first. */
export async function listPasskeys(userId: UserId): Promise<PasskeySummary[]> {
	const rows = await db
		.select({
			id: passkeys.id,
			name: passkeys.name,
			createdAt: passkeys.createdAt,
			backedUp: passkeys.backedUp
		})
		.from(passkeys)
		.where(eq(passkeys.userId, userId))
		.orderBy(passkeys.createdAt);

	return rows.map(({ backedUp, ...row }) => ({ ...row, syncedAcrossDevices: backedUp }));
}

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);

/** Renames one of the acting user's own passkeys. */
export async function renamePasskey(
	userId: UserId,
	passkeyId: unknown,
	name: unknown
): Promise<{ status: 'renamed' | 'not_found' | 'name_invalid' }> {
	const parsedName = nameSchema.safeParse(name);
	if (!parsedName.success) return { status: 'name_invalid' };
	if (typeof passkeyId !== 'string') return { status: 'not_found' };

	const updated = await db
		.update(passkeys)
		.set({ name: parsedName.data })
		// The user ID is part of the condition, so only their own passkey can be reached.
		.where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)))
		.returning({ id: passkeys.id });
	return { status: updated.length === 1 ? 'renamed' : 'not_found' };
}

export type RemovePasskeyResult = { status: 'removed' | 'not_found' | 'last_method' };

/** Removes one of the acting user's own passkeys, unless it is their last way to sign in. */
export async function removePasskey(
	user: SessionUser,
	passkeyId: unknown,
	context: RequestContext
): Promise<RemovePasskeyResult> {
	assertNotImpersonating(user);
	const userId = user.id;
	if (typeof passkeyId !== 'string') return { status: 'not_found' };

	const [own] = await db
		.select({ id: passkeys.id })
		.from(passkeys)
		.where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)));
	if (!own) return { status: 'not_found' };

	if ((await signInMethodCount(userId)) <= 1) return { status: 'last_method' };

	await db.delete(passkeys).where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)));
	await recordAuditEvent(userId, 'passkey_removed', userId, context);
	return { status: 'removed' };
}
