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
import { exportMyData, listConsents } from './data-export';
import { requestPasswordReset } from './password-reset';
import { updateProfile } from './profile';
import { accounts, auditEvents, passkeys, sessions, twoFactors, verifications } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { confirmTwoStepSetup, startTwoStepSetup } from './two-step';
import { changeUsername } from './username';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const password = 'Correct-Horse-42';

let annaJar: TestCookieJar;
let anna: SessionUser;
let bo: SessionUser;

async function exported(user: SessionUser) {
	const result = await exportMyData(user, testContext);
	if (result.status !== 'ready') throw new Error('Export was not ready');
	return result.data as Record<string, never> & {
		profile: Record<string, unknown>;
		preferences: Record<string, unknown>;
		signInMethods: { hasPassword: boolean; passkeys: unknown[]; twoStepVerification: boolean };
		sessions: unknown[];
		consents: { document: string }[];
		usernamesOnHold: { username: string }[];
		securityEvents: { action: string }[];
	};
}

beforeEach(async () => {
	await resetDatabase();
	annaJar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(annaJar.headers()))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;

	// Give Anna one of everything, including every kind of secret.
	await updateProfile(anna.id, { name: 'Anna Berg', locale: 'sv', timeZone: 'Europe/Stockholm' });
	await changeUsername(anna.id, 'anna');
	await changeUsername(anna.id, 'anna.berg');
	await db.insert(passkeys).values({
		id: 'pk1',
		userId: anna.id,
		name: 'My laptop',
		publicKey: 'PASSKEY-PUBLIC-KEY-BYTES',
		credentialID: 'PASSKEY-CREDENTIAL-ID',
		counter: 0,
		deviceType: 'multiDevice',
		backedUp: true
	});
	const started = await startTwoStepSetup(anna, annaJar.headers(), password, testContext);
	if (started.status !== 'started') throw new Error('Two-step set-up did not start');
	await confirmTwoStepSetup(
		anna,
		annaJar.headers(),
		annaJar,
		authenticatorCode(started.setupKey),
		testContext
	);
	await requestPasswordReset('anna@example.com', testContext);
	anna = (await getSessionUser(annaJar.headers()))!;
});

describe('listConsents', () => {
	it('lists what the person accepted, with version and time', async () => {
		const list = await listConsents(anna.id);

		expect(list.map((consent) => consent.document).sort()).toEqual([
			'age_confirmation',
			'privacy',
			'terms'
		]);
		expect(list[0]).toMatchObject({ version: '1' });
		expect(list[0].acceptedAt).toBeInstanceOf(Date);
	});
});

describe('exportMyData', () => {
	it('contains the profile, preferences, sign-in methods, sessions, consents and security events', async () => {
		const data = await exported(anna);

		expect(data.profile).toMatchObject({
			id: anna.id,
			name: 'Anna Berg',
			email: 'anna@example.com',
			emailVerified: true,
			username: 'anna.berg'
		});
		expect(data.preferences).toEqual({ language: 'sv', timeZone: 'Europe/Stockholm' });
		expect(data.signInMethods).toMatchObject({ hasPassword: true, twoStepVerification: true });
		expect(data.signInMethods.passkeys).toEqual([
			expect.objectContaining({ name: 'My laptop', syncedAcrossDevices: true })
		]);
		expect(data.sessions.length).toBeGreaterThan(0);
		expect(data.consents.map((consent) => consent.document).sort()).toEqual([
			'age_confirmation',
			'privacy',
			'terms'
		]);
		expect(data.usernamesOnHold.map((hold) => hold.username)).toEqual(['anna']);
		expect(data.securityEvents.map((event) => event.action)).toEqual(
			expect.arrayContaining(['signup', 'email_verified', 'two_step_turned_on'])
		);
	});

	it('contains no password hash, token or secret', async () => {
		const text = JSON.stringify(await exported(anna));

		const [account] = await db.select().from(accounts).where(eq(accounts.userId, anna.id));
		const ownSessions = await db.select().from(sessions).where(eq(sessions.userId, anna.id));
		const [twoStep] = await db.select().from(twoFactors).where(eq(twoFactors.userId, anna.id));
		const links = await db.select().from(verifications);

		expect(account.password).toBeTruthy();
		expect(text).not.toContain(account.password!);
		expect(text).not.toContain(password);
		for (const session of ownSessions) expect(text).not.toContain(session.token);
		expect(text).not.toContain(twoStep.secret);
		expect(text).not.toContain(twoStep.backupCodes);
		expect(text).not.toContain('PASSKEY-PUBLIC-KEY-BYTES');
		expect(text).not.toContain('PASSKEY-CREDENTIAL-ID');
		expect(links.length).toBeGreaterThan(0);
		for (const link of links) {
			expect(text).not.toContain(link.value === anna.id ? link.identifier : link.value);
		}
		expect(text).not.toMatch(/"(password|token|secret|backupCodes|publicKey|credentialID)"/);
	});

	it('contains nothing about anyone else', async () => {
		const text = JSON.stringify(await exported(anna));

		expect(text).not.toContain(bo.id);
		expect(text).not.toContain('bo@example.com');
		expect(text).not.toContain('Bo Lind');
	});

	it('gives each person only their own data', async () => {
		const bos = await exported(bo);

		expect(bos.profile).toMatchObject({ id: bo.id, email: 'bo@example.com' });
		expect(JSON.stringify(bos)).not.toContain('anna@example.com');
		expect(JSON.stringify(bos)).not.toContain(anna.id);
	});

	it('records that the data was downloaded', async () => {
		await exported(anna);

		const events = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'data_exported'));
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ actorUserId: anna.id, subjectUserId: anna.id });
	});

	it('allows five downloads an hour', async () => {
		for (let attempt = 0; attempt < 5; attempt++) {
			expect((await exportMyData(anna, testContext)).status).toBe('ready');
		}

		expect((await exportMyData(anna, testContext)).status).toBe('rate_limited');
		expect((await exportMyData(bo, testContext)).status).toBe('ready');
	});

	it('is refused to an admin viewing the app as the person', async () => {
		await expect(
			exportMyData({ ...anna, impersonatedBy: bo.id }, testContext)
		).rejects.toMatchObject({ status: 403 });
	});
});
