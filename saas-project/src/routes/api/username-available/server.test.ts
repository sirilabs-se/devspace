import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUp } from '$lib/server/modules/identity';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { GET } from './+server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

function check(query: string) {
	const event = { url: new URL(`http://localhost:5173/api/username-available${query}`) };
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
				email: 'anna@example.com',
				password: 'correct horse battery',
				username: 'anna',
				acceptTerms: true,
				confirmAge: true
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

	it('answers 400 when no username is given', async () => {
		await expect(check('')).rejects.toMatchObject({ status: 400 });
	});
});
