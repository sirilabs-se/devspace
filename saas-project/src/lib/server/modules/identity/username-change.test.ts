import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { createSignedInUser, testContext } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { getProfile } from './profile';
import { usernameHolds, users } from './schema';
import { getSessionUser } from './session';
import { signUp } from './sign-up';
import type { UserId } from './user-id';
import { changeUsername, checkUsernameAvailable, usernameChangeAllowedAt } from './username';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const start = new Date('2026-10-10T12:00:00Z');
const after = (days: number) => new Date(start.getTime() + days * DAY);

let anna: UserId;
let bo: UserId;

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!.id;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!
		.id;
});

describe('changeUsername', () => {
	it('lets a person with no username set one, without starting the 30-day clock', async () => {
		expect(await changeUsername(anna, 'Anna.Berg', start)).toEqual({ status: 'changed' });

		expect((await getProfile(anna)).username).toBe('Anna.Berg');
		expect(await usernameChangeAllowedAt(anna, start)).toBeNull();
		expect(await db.select().from(usernameHolds)).toHaveLength(0);
	});

	it('changes a username and holds the old one, so nobody else can take it', async () => {
		await changeUsername(anna, 'anna', start);

		expect(await changeUsername(anna, 'anna.berg', after(1))).toEqual({ status: 'changed' });

		expect(await checkUsernameAvailable('anna', bo, after(2))).toEqual({
			available: false,
			reason: 'taken'
		});
		expect(await checkUsernameAvailable('ANNA', null, after(2))).toEqual({
			available: false,
			reason: 'taken'
		});
		expect(await changeUsername(bo, 'anna', after(2))).toEqual({ status: 'taken' });
		const signUpResult = await signUp(
			{
				name: 'Carl',
				email: 'carl@example.com',
				password: 'Correct-Horse-42',
				username: 'anna',
				acceptTerms: true
			},
			{ ...testContext, ipAddress: '198.51.100.9' }
		);
		expect(signUpResult).toEqual({ ok: false, errors: { username: 'username_taken' } });
	});

	it('refuses a second change within 30 days and says when it is allowed', async () => {
		await changeUsername(anna, 'anna', start);
		await changeUsername(anna, 'anna.berg', after(1));

		const result = await changeUsername(anna, 'anna.b', after(20));

		expect(result).toEqual({ status: 'too_soon', allowedAt: after(31) });
		expect((await getProfile(anna)).username).toBe('anna.berg');
		expect(await usernameChangeAllowedAt(anna, after(20))).toEqual(after(31));
	});

	it('allows another change once 30 days have passed', async () => {
		await changeUsername(anna, 'anna', start);
		await changeUsername(anna, 'anna.berg', after(1));

		expect(await changeUsername(anna, 'anna.b', after(32))).toEqual({ status: 'changed' });
		expect(await usernameChangeAllowedAt(anna, after(32))).toEqual(after(62));
	});

	it('frees the old name for others after 30 days', async () => {
		await changeUsername(anna, 'anna', start);
		await changeUsername(anna, 'anna.berg', after(1));

		expect(await checkUsernameAvailable('anna', bo, after(30))).toMatchObject({ available: false });
		expect(await checkUsernameAvailable('anna', bo, after(32))).toEqual({ available: true });
		expect(await changeUsername(bo, 'anna', after(32))).toEqual({ status: 'changed' });
	});

	it('lets the owner take their own held name back, when the clock allows', async () => {
		await changeUsername(anna, 'anna', start);
		await changeUsername(anna, 'anna.berg', after(1));

		expect(await checkUsernameAvailable('anna', anna, after(5))).toEqual({ available: true });
		expect(await changeUsername(anna, 'anna', after(5))).toMatchObject({ status: 'too_soon' });
		expect(await changeUsername(anna, 'anna', after(32))).toEqual({ status: 'changed' });

		const holds = await db.select().from(usernameHolds);
		expect(holds.map((hold) => hold.username)).toEqual(['anna.berg']);
	});

	it('treats a change of capital letters only as no change of name', async () => {
		await changeUsername(anna, 'anna', start);

		expect(await changeUsername(anna, 'Anna', after(1))).toEqual({ status: 'changed' });
		expect(await changeUsername(anna, 'Anna', after(1))).toEqual({ status: 'unchanged' });

		expect((await getProfile(anna)).username).toBe('Anna');
		expect(await usernameChangeAllowedAt(anna, after(1))).toBeNull();
		expect(await db.select().from(usernameHolds)).toHaveLength(0);
	});

	it('lets a person remove their username, holding the old one', async () => {
		await changeUsername(anna, 'anna', start);

		expect(await changeUsername(anna, '', after(1))).toEqual({ status: 'changed' });

		expect((await getProfile(anna)).username).toBeNull();
		expect(await checkUsernameAvailable('anna', bo, after(2))).toMatchObject({ available: false });
	});

	it('refuses a badly formed, reserved or taken name', async () => {
		await changeUsername(bo, 'bo.lind', start);

		expect(await changeUsername(anna, '.anna', start)).toEqual({ status: 'invalid' });
		expect(await changeUsername(anna, 'admin', start)).toEqual({ status: 'reserved' });
		expect(await changeUsername(anna, 'Bo.Lind', start)).toEqual({ status: 'taken' });
		expect((await getProfile(anna)).username).toBeNull();
	});

	it('changes only the acting user’s username', async () => {
		await changeUsername(bo, 'bo.lind', start);

		await changeUsername(anna, 'anna', start);

		const [boRow] = await db.select().from(users).where(eq(users.id, bo));
		expect(boRow.username).toBe('bo.lind');
		expect(boRow.usernameChangedAt).toBeNull();
	});
});
