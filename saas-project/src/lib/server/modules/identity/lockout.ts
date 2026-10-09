import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { consumeRateLimit, rateLimitKey } from './rate-limit';
import { rateLimits } from './schema';

// After this many failed logins in a row for one email, further attempts must wait.
const FAILURES_BEFORE_LOCKOUT = 5;
// The wait starts at 1 minute and doubles with each further failure, up to 15 minutes.
const FIRST_WAIT_SECONDS = 60;
const LONGEST_WAIT_SECONDS = 15 * 60;
// A run of failures is forgotten after a day without another one.
const FAILURES_FORGOTTEN_AFTER_SECONDS = 24 * 60 * 60;

const key = (email: string) => rateLimitKey('login-lockout', email);

/** How long logins for an email must wait after this many failures in a row. */
export function lockoutWaitSeconds(failures: number): number {
	if (failures < FAILURES_BEFORE_LOCKOUT) return 0;
	const doubled = FIRST_WAIT_SECONDS * 2 ** (failures - FAILURES_BEFORE_LOCKOUT);
	return Math.min(doubled, LONGEST_WAIT_SECONDS);
}

/**
 * Seconds until a login for this email may be tried again, or 0 if it may be
 * tried now. The same for every email, registered or not.
 */
export async function lockoutSecondsLeft(email: string, now: number = Date.now()): Promise<number> {
	const [row] = await db
		.select()
		.from(rateLimits)
		.where(eq(rateLimits.key, key(email)));
	if (!row) return 0;

	const unlocksAt = row.lastRequest + lockoutWaitSeconds(row.count) * 1000;
	return unlocksAt > now ? Math.ceil((unlocksAt - now) / 1000) : 0;
}

/** Counts one failed login for this email. */
export async function recordLoginFailure(email: string, now: number = Date.now()): Promise<void> {
	// A window that restarts with every failure: the count grows while failures
	// keep coming, and starts again from one after a quiet day.
	const [row] = await db
		.select()
		.from(rateLimits)
		.where(eq(rateLimits.key, key(email)));
	const stale = row && now - row.lastRequest > FAILURES_FORGOTTEN_AFTER_SECONDS * 1000;
	if (stale) await clearLoginFailures(email);

	await consumeRateLimit(
		key(email),
		Number.MAX_SAFE_INTEGER,
		FAILURES_FORGOTTEN_AFTER_SECONDS,
		now
	);
	await db
		.update(rateLimits)
		.set({ lastRequest: now })
		.where(eq(rateLimits.key, key(email)));
}

/** Forgets the failed logins for this email, after a successful login or a password reset. */
export async function clearLoginFailures(email: string): Promise<void> {
	await db.delete(rateLimits).where(eq(rateLimits.key, key(email)));
}
