import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { changePassword, signOutEverywhere } from './change-password';
import { logIn } from './log-in';
import { accounts, auditEvents, sessions } from './schema';
import { getSessionUser, type SessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const oldPassword = 'Correct-Horse-42';
const newPassword = 'Brand-New-Horse-7';
const from = (n: number) => ({ ...testContext, ipAddress: `198.51.100.${n}` });

const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);

let jar: TestCookieJar;
let user: SessionUser;

/** A second browser signed in to the same account. */
async function otherBrowser(): Promise<TestCookieJar> {
	const other = new TestCookieJar();
	const result = await logIn({ email, password: oldPassword }, other, from(200));
	expect(result).toEqual({ status: 'signed_in' });
	return other;
}

const change = (input: object) => changePassword(user, jar.headers(), jar, input, testContext);
const valid = {
	currentPassword: oldPassword,
	password: newPassword,
	confirmPassword: newPassword
};

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(email, 'Anna Berg');
	user = (await getSessionUser(jar.headers()))!;
	vi.mocked(sendEmail).mockClear();
});

describe('changePassword', () => {
	it('changes the password when the current one is right', async () => {
		expect(await change(valid)).toEqual({ status: 'done' });

		expect(await logIn({ email, password: newPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(2))).toEqual({
			status: 'invalid'
		});
	});

	it('signs out other browsers but keeps this one signed in', async () => {
		const other = await otherBrowser();

		await change(valid);

		expect(await getSessionUser(other.headers())).toBeNull();
		expect(await getSessionUser(jar.headers())).toMatchObject({ email });
		expect(await db.select().from(sessions)).toHaveLength(1);
	});

	it('records the change and emails a confirmation, without the password', async () => {
		await change(valid);

		expect(await actions()).toContain('password_changed');
		expect(sendEmail).toHaveBeenCalledOnce();
		expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toMatch(/password was changed/);
		const stored = JSON.stringify([
			await db.select().from(auditEvents),
			await db.select().from(accounts)
		]);
		expect(stored).not.toContain(newPassword);
		expect(stored).not.toContain(oldPassword);
	});

	it('refuses a wrong current password and changes nothing', async () => {
		const other = await otherBrowser();

		expect(await change({ ...valid, currentPassword: 'Wrong-Horse-42' })).toEqual({
			status: 'current_password_wrong'
		});

		expect(await getSessionUser(other.headers())).not.toBeNull();
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('refuses a weak new password and new passwords that differ', async () => {
		expect(await change({ ...valid, password: 'sunset', confirmPassword: 'sunset' })).toEqual({
			status: 'password_too_weak'
		});
		expect(await change({ ...valid, confirmPassword: 'Other-Horse-9!' })).toEqual({
			status: 'passwords_differ'
		});
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
	});

	it('pauses after five wrong guesses at the current password', async () => {
		for (let guess = 0; guess < 5; guess++) {
			expect(await change({ ...valid, currentPassword: 'Wrong-Horse-42' })).toEqual({
				status: 'current_password_wrong'
			});
		}

		expect(await change({ ...valid, currentPassword: 'Wrong-Horse-42' })).toMatchObject({
			status: 'rate_limited'
		});
	});

	it('cannot be used to change another person’s password', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;

		// Anna's session, but claiming to act as Bo.
		await expect(changePassword(bo, jar.headers(), jar, valid, testContext)).rejects.toThrow(
			/does not belong/
		);
		await expect(signOutEverywhere(bo, jar.headers(), jar, testContext)).rejects.toThrow(
			/does not belong/
		);

		// Nothing changed for either of them.
		for (const address of [email, 'bo@example.com']) {
			expect(
				await logIn({ email: address, password: oldPassword }, new TestCookieJar(), from(1))
			).toEqual({ status: 'signed_in' });
		}
		expect(await getSessionUser(boJar.headers())).not.toBeNull();
		expect(await getSessionUser(jar.headers())).not.toBeNull();
	});
});

describe('signOutEverywhere', () => {
	it('ends every session, including this one, and no one else’s', async () => {
		const other = await otherBrowser();
		const bo = await createSignedInUser('bo@example.com', 'Bo Lind');
		const before = jar.headers();

		await signOutEverywhere(user, before, jar, testContext);

		expect(await getSessionUser(before)).toBeNull();
		expect(await getSessionUser(other.headers())).toBeNull();
		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await getSessionUser(bo.headers())).toMatchObject({ email: 'bo@example.com' });
		expect(await actions()).toContain('signed_out_everywhere');
	});
});
