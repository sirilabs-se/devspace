import { and, eq, gt, isNull, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { usernameHolds, users } from './schema';
import type { UserId } from './user-id';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** A username can be changed once in this many days, and the old name is held this long. */
export const USERNAME_CHANGE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

// Letters, numbers, dots, hyphens and underscores, starting and ending with a letter or number.
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

// Names nobody may register, so no account can pose as the app or its staff.
const RESERVED_USERNAMES = new Set([
	'about',
	'account',
	'admin',
	'administrator',
	'api',
	'app',
	'contact',
	'help',
	'info',
	'login',
	'logout',
	'me',
	'mod',
	'moderator',
	'null',
	'official',
	'privacy',
	'root',
	'security',
	'settings',
	'signup',
	'staff',
	'support',
	'system',
	'team',
	'terms',
	'undefined',
	'welcome'
]);

export type UsernameProblem = 'invalid' | 'reserved' | 'taken';

export type UsernameAvailability =
	{ available: true } | { available: false; reason: UsernameProblem };

/** Usernames are compared without regard to upper and lower case. */
export function normalizeUsername(username: string): string {
	return username.trim().toLowerCase();
}

/** Checks the format rules and the reserved list, without looking at the database. */
export function usernameFormatProblem(username: string): 'invalid' | 'reserved' | null {
	const normalized = normalizeUsername(username);

	if (
		normalized.length < USERNAME_MIN_LENGTH ||
		normalized.length > USERNAME_MAX_LENGTH ||
		!USERNAME_PATTERN.test(normalized)
	) {
		return 'invalid';
	}
	if (RESERVED_USERNAMES.has(normalized)) return 'reserved';
	return null;
}

/**
 * Says whether a username can be taken, and why not if it can't. A name is
 * taken if someone has it, or if it is on hold for someone else.
 *
 * @param forUser the person asking, if signed in: their own current name and
 *   their own held names count as available to them
 */
export async function checkUsernameAvailable(
	username: string,
	forUser: UserId | null = null,
	now: Date = new Date()
): Promise<UsernameAvailability> {
	const formatProblem = usernameFormatProblem(username);
	if (formatProblem) return { available: false, reason: formatProblem };
	const normalized = normalizeUsername(username);

	const [owner] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.username, normalized), forUser ? ne(users.id, forUser) : undefined))
		.limit(1);
	if (owner) return { available: false, reason: 'taken' };

	const [hold] = await db
		.select({ id: usernameHolds.id })
		.from(usernameHolds)
		.where(
			and(
				eq(usernameHolds.username, normalized),
				or(isNull(usernameHolds.releaseAt), gt(usernameHolds.releaseAt, now)),
				forUser ? or(isNull(usernameHolds.userId), ne(usernameHolds.userId, forUser)) : undefined
			)
		)
		.limit(1);
	return hold ? { available: false, reason: 'taken' } : { available: true };
}

export type ChangeUsernameResult =
	| { status: 'changed' }
	| { status: 'unchanged' }
	| { status: 'invalid' | 'reserved' | 'taken' }
	| { status: 'too_soon'; allowedAt: Date };

/** When the acting user may next change their username, or null if they may now. */
export async function usernameChangeAllowedAt(
	userId: UserId,
	now: Date = new Date()
): Promise<Date | null> {
	const [user] = await db
		.select({ changedAt: users.usernameChangedAt })
		.from(users)
		.where(eq(users.id, userId));
	if (!user?.changedAt) return null;

	const allowedAt = new Date(user.changedAt.getTime() + USERNAME_CHANGE_DAYS * DAY);
	return allowedAt > now ? allowedAt : null;
}

/**
 * Sets, changes or removes the acting user's username.
 *
 * - Setting a first username is always allowed.
 * - Replacing or removing one is allowed once every 30 days.
 * - The old name is held for 30 days, so nobody else can take it. Its owner may take it back.
 * - Changing only the capital letters is not a change of name.
 */
export async function changeUsername(
	userId: UserId,
	requested: unknown,
	now: Date = new Date()
): Promise<ChangeUsernameResult> {
	const typed = typeof requested === 'string' ? requested.trim() : '';
	const normalized = typed === '' ? null : normalizeUsername(typed);

	const [user] = await db
		.select({ username: users.username, displayUsername: users.displayUsername })
		.from(users)
		.where(eq(users.id, userId));
	if (!user) throw new Error('The acting user no longer exists');

	if (normalized === user.username) {
		if (normalized !== null && typed !== user.displayUsername) {
			await db.update(users).set({ displayUsername: typed }).where(eq(users.id, userId));
			return { status: 'changed' };
		}
		return { status: 'unchanged' };
	}

	if (normalized !== null) {
		const availability = await checkUsernameAvailable(normalized, userId, now);
		if (!availability.available) return { status: availability.reason };
	}

	const replacing = user.username !== null;
	if (replacing) {
		const allowedAt = await usernameChangeAllowedAt(userId, now);
		if (allowedAt) return { status: 'too_soon', allowedAt };
	}

	try {
		await db.transaction(async (tx) => {
			if (user.username !== null) {
				const releaseAt = new Date(now.getTime() + USERNAME_CHANGE_DAYS * DAY);
				await tx
					.insert(usernameHolds)
					.values({ username: user.username, userId, releaseAt })
					.onConflictDoUpdate({
						target: usernameHolds.username,
						set: { userId, releaseAt }
					});
			}
			// Taking back a name of one's own releases its hold.
			if (normalized !== null) {
				await tx.delete(usernameHolds).where(eq(usernameHolds.username, normalized));
			}
			await tx
				.update(users)
				.set({
					username: normalized,
					displayUsername: normalized === null ? null : typed,
					...(replacing ? { usernameChangedAt: now } : {})
				})
				.where(eq(users.id, userId));
		});
	} catch (error) {
		// Someone else took the name between the check above and now.
		const code = (error as { cause?: { code?: string } }).cause?.code;
		if (code === '23505') return { status: 'taken' };
		throw error;
	}

	return { status: 'changed' };
}
