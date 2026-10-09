import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { consumeRateLimit, rateLimitKey } from './rate-limit';
import { rateLimits } from './schema';

beforeEach(async () => {
	await resetDatabase();
});

describe('consumeRateLimit', () => {
	const start = Date.UTC(2026, 9, 10, 12, 0, 0);

	it('allows attempts up to the limit and refuses the next one', async () => {
		for (let attempt = 1; attempt <= 3; attempt++) {
			expect(await consumeRateLimit('k', 3, 3600, start + attempt)).toEqual({ allowed: true });
		}

		expect(await consumeRateLimit('k', 3, 3600, start + 4)).toMatchObject({ allowed: false });
	});

	it('says how long until the window ends', async () => {
		for (let attempt = 0; attempt < 3; attempt++) await consumeRateLimit('k', 3, 3600, start);

		const tenMinutesLater = start + 10 * 60 * 1000;
		expect(await consumeRateLimit('k', 3, 3600, tenMinutesLater)).toEqual({
			allowed: false,
			retryAfterSeconds: 50 * 60
		});
	});

	it('starts a fresh window once the old one has passed', async () => {
		for (let attempt = 0; attempt < 4; attempt++) await consumeRateLimit('k', 3, 3600, start);

		const anHourLater = start + 3600 * 1000;
		expect(await consumeRateLimit('k', 3, 3600, anHourLater)).toEqual({ allowed: true });
	});

	it('counts each key on its own', async () => {
		for (let attempt = 0; attempt < 4; attempt++) await consumeRateLimit('a', 3, 3600, start);

		expect(await consumeRateLimit('b', 3, 3600, start)).toEqual({ allowed: true });
	});
});

describe('rateLimitKey', () => {
	it('does not store the email address itself', async () => {
		const key = rateLimitKey('verify-resend', 'anna@example.com');
		await consumeRateLimit(key, 3, 3600);

		const [row] = await db.select().from(rateLimits);
		expect(row.key).toMatch(/^verify-resend:[0-9a-f]{64}$/);
		expect(row.key).not.toContain('anna');
	});
});
