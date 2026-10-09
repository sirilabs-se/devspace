import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** A key for something personal, such as an email address, that can't be read back from the table. */
export function rateLimitKey(action: string, subject: string): string {
	return `${action}:${createHash('sha256').update(subject).digest('hex')}`;
}

/**
 * Counts one attempt and says whether it is within the limit.
 *
 * Attempts are counted in windows: the first attempt starts a window, and up
 * to `limit` attempts are allowed until `windowSeconds` after it.
 */
export async function consumeRateLimit(
	key: string,
	limit: number,
	windowSeconds: number,
	now: number = Date.now()
): Promise<RateLimitResult> {
	const windowStart = now - windowSeconds * 1000;

	const result = await db.execute<{ count: number; last_request: string }>(sql`
		insert into rate_limits (id, key, count, last_request)
		values (${randomUUID()}, ${key}, 1, ${now})
		on conflict (key) do update set
			count = case when rate_limits.last_request <= ${windowStart} then 1 else rate_limits.count + 1 end,
			last_request = case when rate_limits.last_request <= ${windowStart} then ${now} else rate_limits.last_request end
		returning count, last_request
	`);

	const row = result.rows[0];
	if (row.count <= limit) return { allowed: true };

	const windowEnds = Number(row.last_request) + windowSeconds * 1000;
	return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowEnds - now) / 1000)) };
}
