import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUp } from '$lib/server/modules/identity';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { GET } from './+server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

function check(query: string, ipAddress = '203.0.113.5') {
	const event = {
		url: new URL(`http://localhost:5173/api/username-available${query}`),
		getClientAddress: () => ipAddress
	};
	return GET(event as unknown as Parameters<typeof GET>[0]);
}

beforeEach(async () => {
	await resetDatabase();
});

describe('GET /api/username-available', () => {
	it('says a free username is available', async () => {
		const response = await check('?username=anna');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ available: true });
	});

	it('says why a username is not available', async () => {
		await signUp(
			{
				name: 'Anna Berg',
				email: 'anna@example.com',
				password: 'Correct-Horse-42',
				username: 'anna',
				acceptTerms: true
			},
			{ ipAddress: null, userAgent: null }
		);

		expect(await (await check('?username=Anna')).json()).toEqual({
			available: false,
			reason: 'taken'
		});
		expect(await (await check('?username=admin')).json()).toEqual({
			available: false,
			reason: 'reserved'
		});
		expect(await (await check('?username=a%20b')).json()).toEqual({
			available: false,
			reason: 'invalid'
		});
	});

	it('refuses the 61st check in a minute from one address, but not from another', async () => {
		for (let attempt = 0; attempt < 60; attempt++) {
			expect((await check('?username=anna')).status).toBe(200);
		}

		const refused = await check('?username=anna');
		expect(refused.status).toBe(429);
		expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
		expect(await refused.json()).toEqual({ message: 'Too many checks. Try again shortly.' });

		expect((await check('?username=anna', '198.51.100.7')).status).toBe(200);
	});

	it('answers 400 when no username is given', async () => {
		await expect(check('')).rejects.toMatchObject({ status: 400 });
	});
});
