import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { authenticatorCode } from '../../../../../tests/setup/totp';
import { logIn } from './log-in';
import { auditEvents, sessions, twoFactors } from './schema';
import { getSessionUser, type SessionUser } from './session';
import {
	completeTwoStepLogin,
	confirmTwoStepSetup,
	hasTwoStepChallenge,
	isTwoStepOn,
	regenerateBackupCodes,
	startTwoStepSetup,
	turnOffTwoStep
} from './two-step';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const password = 'Correct-Horse-42';
let address = 0;
const from = () => ({ ...testContext, ipAddress: `198.51.100.${(address++ % 200) + 1}` });

const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);

let jar: TestCookieJar;
let anna: SessionUser;

/** Switches the second step on, and returns what the person was shown. */
async function turnOn() {
	const started = await startTwoStepSetup(anna, jar.headers(), password, testContext);
	if (started.status !== 'started') throw new Error(`Set-up did not start: ${started.status}`);
	const confirmed = await confirmTwoStepSetup(
		anna,
		jar.headers(),
		jar,
		authenticatorCode(started.setupKey),
		testContext
	);
	expect(confirmed).toEqual({ status: 'on' });
	return started;
}

/** A fresh browser that has entered the right password and now owes a code. */
async function passwordStep() {
	const fresh = new TestCookieJar();
	const result = await logIn({ email, password }, fresh, from());
	return { fresh, result };
}

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(email, 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
});

describe('setting up the second step', () => {
	it('gives a QR address, a set-up key and backup codes, but is not on until a code is entered', async () => {
		const started = await startTwoStepSetup(anna, jar.headers(), password, testContext);

		expect(started.status).toBe('started');
		if (started.status !== 'started') return;
		expect(started.totpUri).toMatch(/^otpauth:\/\/totp\/SaaS/);
		expect(started.setupKey).toMatch(/^[A-Z2-7]+$/);
		expect(started.backupCodes.length).toBeGreaterThanOrEqual(8);
		expect(new Set(started.backupCodes).size).toBe(started.backupCodes.length);

		expect(await isTwoStepOn(anna.id)).toBe(false);
		expect((await passwordStep()).result).toEqual({ status: 'signed_in' });
	});

	it('needs the password to start, and the right code to finish', async () => {
		expect(await startTwoStepSetup(anna, jar.headers(), 'Wrong-Horse-42', testContext)).toEqual({
			status: 'current_password_wrong'
		});

		await startTwoStepSetup(anna, jar.headers(), password, testContext);
		expect(await confirmTwoStepSetup(anna, jar.headers(), jar, '000000', testContext)).toEqual({
			status: 'code_wrong'
		});
		expect(await isTwoStepOn(anna.id)).toBe(false);
	});

	it('switches on with a code from the app, keeps this browser signed in and records it', async () => {
		await turnOn();

		expect(await isTwoStepOn(anna.id)).toBe(true);
		expect(await getSessionUser(jar.headers())).toMatchObject({ email });
		expect(await actions()).toContain('two_step_turned_on');
		expect(await startTwoStepSetup(anna, jar.headers(), password, testContext)).toEqual({
			status: 'already_on'
		});
	});

	it('stores the secret and backup codes encrypted', async () => {
		const started = await turnOn();

		const [row] = await db.select().from(twoFactors).where(eq(twoFactors.userId, anna.id));
		expect(row.secret).not.toContain(started.setupKey);
		for (const code of started.backupCodes) expect(row.backupCodes).not.toContain(code);
	});
});

describe('logging in with the second step on', () => {
	it('asks for a code after the right password, without signing in yet', async () => {
		await turnOn();
		await db.delete(sessions);

		const { fresh, result } = await passwordStep();

		expect(result).toEqual({ status: 'second_step' });
		expect(hasTwoStepChallenge(fresh.headers())).toBe(true);
		expect(await getSessionUser(fresh.headers())).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('signs in with a code from the app, and records which second step was used', async () => {
		const started = await turnOn();
		const { fresh } = await passwordStep();

		const result = await completeTwoStepLogin(
			'app',
			authenticatorCode(started.setupKey),
			fresh.headers(),
			fresh,
			from()
		);

		expect(result).toEqual({ status: 'signed_in' });
		expect(await getSessionUser(fresh.headers())).toMatchObject({ email });
		const [event] = (
			await db
				.select()
				.from(auditEvents)
				.where(eq(auditEvents.action, 'login'))
				.orderBy(auditEvents.id)
		).slice(-1);
		expect(event.details).toMatchObject({ method: 'password', secondStep: 'authenticator' });
	});

	it('refuses a wrong code and does not sign in', async () => {
		await turnOn();
		const { fresh } = await passwordStep();

		expect(await completeTwoStepLogin('app', '000000', fresh.headers(), fresh, from())).toEqual({
			status: 'code_wrong'
		});
		expect(await getSessionUser(fresh.headers())).toBeNull();
		expect(await actions()).toContain('two_step_failed');
	});

	it('does nothing for someone who has not passed the password step', async () => {
		const started = await turnOn();
		const stranger = new TestCookieJar();

		const result = await completeTwoStepLogin(
			'app',
			authenticatorCode(started.setupKey),
			stranger.headers(),
			stranger,
			from()
		);

		expect(result).toEqual({ status: 'no_challenge' });
		expect(await getSessionUser(stranger.headers())).toBeNull();
	});

	it('still refuses a wrong password before any code is asked for', async () => {
		await turnOn();
		const fresh = new TestCookieJar();

		expect(await logIn({ email, password: 'Wrong-Horse-42' }, fresh, from())).toEqual({
			status: 'invalid'
		});
		expect(hasTwoStepChallenge(fresh.headers())).toBe(false);
	});

	it('pauses after ten code attempts from one network address', async () => {
		await turnOn();
		const { fresh } = await passwordStep();
		const oneAddress = { ...testContext, ipAddress: '203.0.113.99' };

		for (let attempt = 0; attempt < 10; attempt++) {
			await completeTwoStepLogin('app', '000000', fresh.headers(), fresh, oneAddress);
		}

		expect(
			await completeTwoStepLogin('app', '000000', fresh.headers(), fresh, oneAddress)
		).toMatchObject({ status: 'rate_limited' });
	});
});

describe('backup codes', () => {
	it('work once only', async () => {
		const { backupCodes } = await turnOn();
		const first = await passwordStep();

		expect(
			await completeTwoStepLogin(
				'backup',
				backupCodes[0],
				first.fresh.headers(),
				first.fresh,
				from()
			)
		).toEqual({ status: 'signed_in' });

		const second = await passwordStep();
		expect(
			await completeTwoStepLogin(
				'backup',
				backupCodes[0],
				second.fresh.headers(),
				second.fresh,
				from()
			)
		).toEqual({ status: 'code_wrong' });
		expect(
			await completeTwoStepLogin(
				'backup',
				backupCodes[1],
				second.fresh.headers(),
				second.fresh,
				from()
			)
		).toEqual({ status: 'signed_in' });
	});

	it('stop working when new ones are made', async () => {
		const { backupCodes: oldCodes } = await turnOn();

		const regenerated = await regenerateBackupCodes(anna, jar.headers(), password, testContext);

		expect(regenerated.status).toBe('done');
		if (regenerated.status !== 'done') return;
		expect(regenerated.backupCodes).not.toEqual(oldCodes);
		expect(await actions()).toContain('backup_codes_regenerated');

		const withOld = await passwordStep();
		expect(
			await completeTwoStepLogin(
				'backup',
				oldCodes[0],
				withOld.fresh.headers(),
				withOld.fresh,
				from()
			)
		).toEqual({ status: 'code_wrong' });
		expect(
			await completeTwoStepLogin(
				'backup',
				regenerated.backupCodes[0],
				withOld.fresh.headers(),
				withOld.fresh,
				from()
			)
		).toEqual({ status: 'signed_in' });
	});

	it('need the password to regenerate', async () => {
		await turnOn();

		expect(await regenerateBackupCodes(anna, jar.headers(), 'Wrong-Horse-42', testContext)).toEqual(
			{
				status: 'current_password_wrong'
			}
		);
	});
});

describe('turning the second step off', () => {
	it('needs the password, then logins need only the password again', async () => {
		await turnOn();

		expect(await turnOffTwoStep(anna, jar.headers(), jar, 'Wrong-Horse-42', testContext)).toEqual({
			status: 'current_password_wrong'
		});
		expect(await isTwoStepOn(anna.id)).toBe(true);

		expect(await turnOffTwoStep(anna, jar.headers(), jar, password, testContext)).toEqual({
			status: 'off'
		});
		expect(await isTwoStepOn(anna.id)).toBe(false);
		expect(await db.select().from(twoFactors)).toHaveLength(0);
		expect((await passwordStep()).result).toEqual({ status: 'signed_in' });
		expect(await actions()).toContain('two_step_turned_off');
	});

	it('leaves another person’s second step alone, and refuses a session that isn’t theirs', async () => {
		await turnOn();
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;

		expect(await turnOffTwoStep(bo, boJar.headers(), boJar, password, testContext)).toEqual({
			status: 'not_on'
		});
		await expect(
			turnOffTwoStep(anna, boJar.headers(), boJar, password, testContext)
		).rejects.toThrow(/does not belong/);
		expect(await isTwoStepOn(anna.id)).toBe(true);
	});
});
