import { consumeRateLimit, rateLimitKey, type RateLimitResult } from './rate-limit';

/** How many requests one address (IP) or one email may make, and in how long. */
const LIMITS = {
	'signup-by-ip': { limit: 10, windowSeconds: 60 * 60 },
	'signup-by-email': { limit: 5, windowSeconds: 60 * 60 },
	'login-by-ip': { limit: 30, windowSeconds: 15 * 60 },
	'username-check-by-ip': { limit: 60, windowSeconds: 60 },
	'password-reset-by-ip': { limit: 10, windowSeconds: 60 * 60 },
	'password-reset-by-email': { limit: 3, windowSeconds: 60 * 60 },
	'email-change-by-user': { limit: 3, windowSeconds: 60 * 60 }
} as const;

export type RequestLimit = keyof typeof LIMITS;

/**
 * Counts one request against a limit and says whether it is allowed.
 * `subject` is the IP address or email being counted; a missing one is not limited.
 */
export async function limitRequests(
	name: RequestLimit,
	subject: string | null,
	now: number = Date.now()
): Promise<RateLimitResult> {
	if (!subject) return { allowed: true };
	const { limit, windowSeconds } = LIMITS[name];
	return consumeRateLimit(rateLimitKey(name, subject), limit, windowSeconds, now);
}

export const REQUEST_LIMITS: Readonly<
	Record<RequestLimit, { limit: number; windowSeconds: number }>
> = LIMITS;
