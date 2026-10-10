import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { consumeRateLimit, rateLimitKey } from './rate-limit';
import { rateLimits } from './schema';
import type { UserId } from './user-id';

// Several settings ask a signed-in person for their password again: changing
// it, changing the email, deleting the account, the second step. Wrong guesses
// are counted per account across all of them, so a stolen session can't be
// used to find the password by trying one after another.

const WRONG_GUESSES_ALLOWED = 5;
const WINDOW_SECONDS = 15 * 60;

const key = (userId: UserId) => rateLimitKey('password-guess', userId);

/**
 * Seconds until this account's password may be asked for again, or 0 if it may
 * be now. Checked before the password is looked at, so that during the wait
 * even the right password is refused.
 */
export async function passwordGuessWaitSeconds(
	userId: UserId,
	now: number = Date.now()
): Promise<number> {
	const [row] = await db
		.select()
		.from(rateLimits)
		.where(eq(rateLimits.key, key(userId)));
	if (!row || row.count < WRONG_GUESSES_ALLOWED) return 0;

	const windowEnds = row.lastRequest + WINDOW_SECONDS * 1000;
	return windowEnds > now ? Math.ceil((windowEnds - now) / 1000) : 0;
}

/** Counts one wrong guess at this account's password. */
export async function recordWrongPasswordGuess(
	userId: UserId,
	now: number = Date.now()
): Promise<void> {
	await consumeRateLimit(key(userId), WRONG_GUESSES_ALLOWED, WINDOW_SECONDS, now);
}
