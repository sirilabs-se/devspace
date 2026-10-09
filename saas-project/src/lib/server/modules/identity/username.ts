import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from './schema';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

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

/** Says whether a username can be registered, and why not if it can't. */
export async function checkUsernameAvailable(username: string): Promise<UsernameAvailability> {
	const formatProblem = usernameFormatProblem(username);
	if (formatProblem) return { available: false, reason: formatProblem };

	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, normalizeUsername(username)))
		.limit(1);

	return existing ? { available: false, reason: 'taken' } : { available: true };
}
