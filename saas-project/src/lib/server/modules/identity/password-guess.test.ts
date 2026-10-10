import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { requestEmailChange } from './change-email';
import { changePassword } from './change-password';
import { requestAccountDeletion } from './deletion';
import { passwordGuessWaitSeconds, recordWrongPasswordGuess } from './password-guess';
import { users } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { regenerateBackupCodes, startTwoStepSetup, turnOffTwoStep } from './two-step';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const password = 'Correct-Horse-42';
const wrong = 'Wrong-Horse-42';
const paused = { status: 'rate_limited' };

let jar: TestCookieJar;
let anna: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
});

describe('wrong guesses at the password, from a signed-in session', () => {
	it('are counted together across every form that asks for the password', async () => {
		const headers = jar.headers();

		expect(
			await requestEmailChange(
				anna,
				headers,
				{ newEmail: 'new@example.com', currentPassword: wrong },
				testContext
			)
		).toEqual({ status: 'current_password_wrong' });
		expect(
			await requestAccountDeletion(
				anna,
				headers,
				jar,
				{ currentPassword: wrong, confirmed: true },
				testContext
			)
		).toEqual({ status: 'current_password_wrong' });
		expect(await startTwoStepSetup(anna, headers, wrong, testContext)).toEqual({
			status: 'current_password_wrong'
		});
		expect(
			await changePassword(
				anna,
				headers,
				jar,
				{
					currentPassword: wrong,
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				},
				testContext
			)
		).toEqual({ status: 'current_password_wrong' });
		expect(await startTwoStepSetup(anna, headers, wrong, testContext)).toEqual({
			status: 'current_password_wrong'
		});

		// Five wrong guesses: every one of the forms is now paused.
		expect(await passwordGuessWaitSeconds(anna.id)).toBeGreaterThan(0);
	});

	it('pause every such form for 15 minutes, even for the right password', async () => {
		for (let guess = 0; guess < 5; guess++) await recordWrongPasswordGuess(anna.id);
		const headers = jar.headers();

		expect(
			await requestEmailChange(
				anna,
				headers,
				{ newEmail: 'new@example.com', currentPassword: password },
				testContext
			)
		).toMatchObject(paused);
		expect(
			await changePassword(
				anna,
				headers,
				jar,
				{
					currentPassword: password,
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				},
				testContext
			)
		).toMatchObject(paused);
		expect(await startTwoStepSetup(anna, headers, password, testContext)).toMatchObject(paused);
		expect(
			await requestAccountDeletion(
				anna,
				headers,
				jar,
				{ currentPassword: password, confirmed: true },
				testContext
			)
		).toMatchObject(paused);

		// Nothing happened: the account isn't being deleted and Anna is still signed in.
		const [row] = await db.select().from(users).where(eq(users.id, anna.id));
		expect(row).toMatchObject({ deletionRequestedAt: null, twoFactorEnabled: false });
		expect(await getSessionUser(jar.headers())).not.toBeNull();
	});

	it('pause replacing the backup codes and switching the second step off too', async () => {
		await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, anna.id));
		for (let guess = 0; guess < 5; guess++) await recordWrongPasswordGuess(anna.id);
		const headers = jar.headers();

		expect(await regenerateBackupCodes(anna, headers, password, testContext)).toMatchObject(paused);
		expect(await turnOffTwoStep(anna, headers, jar, password, testContext)).toMatchObject(paused);
	});

	it('are allowed again once 15 minutes have passed', async () => {
		const start = Date.now();
		for (let guess = 0; guess < 5; guess++) await recordWrongPasswordGuess(anna.id, start);

		expect(await passwordGuessWaitSeconds(anna.id, start + 60 * 1000)).toBe(14 * 60);
		expect(await passwordGuessWaitSeconds(anna.id, start + 15 * 60 * 1000)).toBe(0);
	});

	it('do not pause below five, or pause anyone else', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;
		for (let guess = 0; guess < 4; guess++) await recordWrongPasswordGuess(anna.id);
		expect(await passwordGuessWaitSeconds(anna.id)).toBe(0);

		await recordWrongPasswordGuess(anna.id);

		expect(await passwordGuessWaitSeconds(anna.id)).toBeGreaterThan(0);
		expect(await passwordGuessWaitSeconds(bo.id)).toBe(0);
	});
});
