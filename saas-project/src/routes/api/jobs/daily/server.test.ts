import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { POST } from './+server';

const run = (headers: Record<string, string> = {}) =>
	POST({
		request: new Request('http://localhost:5173/api/jobs/daily', { method: 'POST', headers })
	} as never);

beforeEach(async () => {
	await resetDatabase();
});

describe('POST /api/jobs/daily', () => {
	it('runs with the right secret and reports what it did', async () => {
		const response = await run({ authorization: 'Bearer test-only-daily-job-secret' });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			accountsDeleted: 0,
			usernameHoldsReleased: 0,
			expiredLinksCleared: 0,
			auditEntriesDeleted: 0,
			countersCleared: 0
		});
	});

	it('refuses to run without the secret, or with a wrong one', async () => {
		for (const headers of [
			{},
			{ authorization: 'Bearer wrong' },
			{ authorization: 'Bearer ' },
			{ authorization: 'test-only-daily-job-secret-but-longer' },
			{ 'x-secret': 'test-only-daily-job-secret' }
		]) {
			await expect(async () => run(headers as Record<string, string>)).rejects.toMatchObject({
				status: 401
			});
		}
	});
});
