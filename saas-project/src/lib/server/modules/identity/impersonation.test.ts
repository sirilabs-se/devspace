import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	makeAdmin,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { searchUsers, suspendUser } from './admin';
import { requestEmailChange } from './change-email';
import { changePassword, signOutEverywhere } from './change-password';
import { setFirstPassword, startLinkingProvider, unlinkProvider } from './connections';
import { requestAccountDeletion } from './deletion';
import { recogniseDevice } from './device-recognition';
import { startImpersonation, stopImpersonation } from './impersonation';
import { logIn } from './log-in';
import { removePasskey } from './passkeys';
import { getProfile, updateProfile } from './profile';
import { auditEvents, consents, sessions, users } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { endSession } from './sessions';
import { completeWelcome, handleAuthRequest } from './social';
import { regenerateBackupCodes, startTwoStepSetup, turnOffTwoStep } from './two-step';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const password = 'Correct-Horse-42';
const emailsTo = (address: string) =>
	vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter((message) => message.to === address);
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);

let adminJar: TestCookieJar;
let admin: SessionUser;
let annaJar: TestCookieJar;
let anna: SessionUser;

/** The admin's browser, now viewing the app as Anna. */
async function impersonate() {
	const result = await startImpersonation(
		admin,
		adminJar.headers(),
		adminJar,
		anna.id,
		testContext
	);
	expect(result).toEqual({ status: 'started' });
	return (await getSessionUser(adminJar.headers()))!;
}

beforeEach(async () => {
	await resetDatabase();
	adminJar = await createSignedInUser('root@example.com', 'Rita Admin');
	await makeAdmin('root@example.com');
	admin = (await getSessionUser(adminJar.headers()))!;
	annaJar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(annaJar.headers()))!;
	vi.mocked(sendEmail).mockClear();
});

describe('startImpersonation', () => {
	it('lets the admin see the app as the user', async () => {
		const asAnna = await impersonate();

		expect(asAnna).toMatchObject({
			id: anna.id,
			email: 'anna@example.com',
			role: 'user',
			impersonatedBy: admin.id
		});
		expect(await getProfile(asAnna.id)).toMatchObject({ name: 'Anna Berg' });
		// As the user, the admin area is closed.
		await expect(searchUsers(asAnna, '')).rejects.toMatchObject({ status: 403 });
		// The user's own session carries on untouched.
		expect(await getSessionUser(annaJar.headers())).toMatchObject({ impersonatedBy: null });
	});

	it('emails the user and records who impersonated whom', async () => {
		await impersonate();

		const [notice] = emailsTo('anna@example.com');
		expect(notice.subject).toMatch(/admin viewed your account/);
		const [event] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'impersonation_started'));
		expect(event).toMatchObject({ actorUserId: admin.id, subjectUserId: anna.id });
	});

	it('lasts at most an hour', async () => {
		await impersonate();

		const [session] = await db.select().from(sessions).where(eq(sessions.impersonatedBy, admin.id));
		const minutes = (session.expiresAt.getTime() - Date.now()) / 60000;
		expect(minutes).toBeGreaterThan(55);
		expect(minutes).toBeLessThan(61);
	});

	it('does not look like a new device to the user, or cancel a pending deletion', async () => {
		await db.execute(sql`update users set created_at = now() - interval '2 days'`);
		await db.execute(
			sql`update users set deletion_requested_at = now() where email = 'anna@example.com'`
		);
		vi.mocked(sendEmail).mockClear();

		const asAnna = await impersonate();
		expect(await recogniseDevice(asAnna, adminJar, testContext)).toBe('known');

		expect(emailsTo('anna@example.com').map((message) => message.subject)).toEqual([
			expect.stringMatching(/admin viewed your account/)
		]);
		const [row] = await db.select().from(users).where(eq(users.id, anna.id));
		expect(row.deletionRequestedAt).not.toBeNull();
	});

	it('is refused for oneself, another admin, a suspended user and nobody', async () => {
		await createSignedInUser('second@example.com', 'Second Admin');
		await makeAdmin('second@example.com');
		const [second] = await db.select().from(users).where(eq(users.email, 'second@example.com'));
		const start = (userId: unknown) =>
			startImpersonation(admin, adminJar.headers(), adminJar, userId, testContext);

		expect(await start(admin.id)).toEqual({ status: 'is_self' });
		expect(await start(second.id)).toEqual({ status: 'is_admin' });
		expect(await start('no-such-user')).toEqual({ status: 'not_found' });
		await suspendUser(admin, anna.id, 'Spamming', testContext);
		expect(await start(anna.id)).toEqual({ status: 'not_found' });
		expect((await getSessionUser(adminJar.headers()))?.id).toBe(admin.id);
	});

	it('is refused to anyone who is not an admin', async () => {
		const bo = (await getSessionUser(
			(await createSignedInUser('bo@example.com', 'Bo Lind')).headers()
		))!;

		await expect(
			startImpersonation(anna, annaJar.headers(), annaJar, bo.id, testContext)
		).rejects.toMatchObject({ status: 403 });
		expect((await getSessionUser(annaJar.headers()))?.id).toBe(anna.id);
	});
});

describe('while impersonating', () => {
	it('refuses changes to the password, email and sign-in methods, and deleting the account', async () => {
		const asAnna = await impersonate();
		const headers = adminJar.headers();
		const refused = { status: 403 };

		await expect(
			changePassword(
				asAnna,
				headers,
				adminJar,
				{
					currentPassword: password,
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				},
				testContext
			)
		).rejects.toMatchObject(refused);
		await expect(
			setFirstPassword(asAnna, headers, { password, confirmPassword: password }, testContext)
		).rejects.toMatchObject(refused);
		await expect(
			requestEmailChange(
				asAnna,
				headers,
				{ newEmail: 'evil@example.com', currentPassword: password },
				testContext
			)
		).rejects.toMatchObject(refused);
		await expect(startLinkingProvider(asAnna, 'google', headers, adminJar)).rejects.toMatchObject(
			refused
		);
		await expect(unlinkProvider(asAnna, 'google', headers, testContext)).rejects.toMatchObject(
			refused
		);
		await expect(removePasskey(asAnna, 'any', testContext)).rejects.toMatchObject(refused);
		await expect(startTwoStepSetup(asAnna, headers, password, testContext)).rejects.toMatchObject(
			refused
		);
		await expect(
			regenerateBackupCodes(asAnna, headers, password, testContext)
		).rejects.toMatchObject(refused);
		await expect(
			turnOffTwoStep(asAnna, headers, adminJar, password, testContext)
		).rejects.toMatchObject(refused);
		await expect(
			requestAccountDeletion(
				asAnna,
				headers,
				adminJar,
				{ currentPassword: password, confirmed: true },
				testContext
			)
		).rejects.toMatchObject(refused);

		// Nothing changed: Anna still signs in with her password and email, and isn't being deleted.
		expect(
			await logIn({ email: 'anna@example.com', password }, new TestCookieJar(), {
				...testContext,
				ipAddress: '198.51.100.9'
			})
		).toEqual({ status: 'signed_in' });
		const [row] = await db.select().from(users).where(eq(users.id, anna.id));
		expect(row).toMatchObject({ email: 'anna@example.com', deletionRequestedAt: null });
	});

	it('refuses adding a passkey', async () => {
		await impersonate();

		const response = await handleAuthRequest(
			new Request('http://localhost:5173/api/auth/passkey/generate-register-options', {
				headers: adminJar.headers()
			})
		);

		expect(response.status).toBe(403);
	});

	it('refuses accepting the terms on the person’s behalf', async () => {
		await db.delete(consents).where(eq(consents.userId, anna.id));
		const asAnna = await impersonate();
		expect(asAnna.welcomePending).toBe(true);

		await expect(
			completeWelcome(asAnna, { acceptTerms: true, username: '' }, testContext)
		).rejects.toMatchObject({ status: 403 });

		expect(await db.select().from(consents).where(eq(consents.userId, anna.id))).toHaveLength(0);
	});

	it('still allows ordinary things, such as editing the profile', async () => {
		const asAnna = await impersonate();

		expect(
			await updateProfile(asAnna.id, { name: 'Anna B.', locale: 'en', timeZone: 'UTC' })
		).toEqual({
			ok: true
		});
	});
});

describe('stopImpersonation', () => {
	it('returns the admin to their own account and records it', async () => {
		const asAnna = await impersonate();

		expect(await stopImpersonation(asAnna, adminJar.headers(), adminJar, testContext)).toEqual({
			status: 'stopped'
		});

		expect(await getSessionUser(adminJar.headers())).toMatchObject({
			id: admin.id,
			role: 'admin',
			impersonatedBy: null
		});
		expect(
			await db.select().from(sessions).where(eq(sessions.impersonatedBy, admin.id))
		).toHaveLength(0);
		const [event] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'impersonation_stopped'));
		expect(event).toMatchObject({ actorUserId: admin.id, subjectUserId: anna.id });
		expect(await actions()).toContain('impersonation_started');
	});

	it('does nothing for someone who isn’t impersonating', async () => {
		expect(await stopImpersonation(anna, annaJar.headers(), annaJar, testContext)).toEqual({
			status: 'not_impersonating'
		});
		expect((await getSessionUser(annaJar.headers()))?.id).toBe(anna.id);
	});

	it('signing the user out of their own devices is refused too', async () => {
		const asAnna = await impersonate();
		const annaSessionId = (
			await db.select().from(sessions).where(eq(sessions.userId, anna.id))
		).find((session) => session.impersonatedBy === null)!.id;

		await expect(
			signOutEverywhere(asAnna, adminJar.headers(), adminJar, testContext)
		).rejects.toMatchObject({ status: 403 });
		await expect(
			endSession(asAnna, adminJar.headers(), annaSessionId, testContext)
		).rejects.toMatchObject({ status: 403 });

		expect(await getSessionUser(annaJar.headers())).toMatchObject({ email: 'anna@example.com' });
	});
});
