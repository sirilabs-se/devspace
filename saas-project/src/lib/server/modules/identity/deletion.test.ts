import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { readAvatar, setAvatar } from './avatar';
import { onUserDeleted, requestAccountDeletion, runDailyJob } from './deletion';
import { logIn } from './log-in';
import { requestPasswordReset } from './password-reset';
import {
	accounts,
	auditEvents,
	consents,
	rateLimits,
	sessions,
	usernameHolds,
	users,
	verifications
} from './schema';
import { getSessionUser, type SessionUser } from './session';
import { signUp } from './sign-up';
import { changeUsername, checkUsernameAvailable } from './username';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const start = new Date('2026-10-10T12:00:00Z');
const after = (days: number) => new Date(start.getTime() + days * DAY);
const email = 'anna@example.com';
const password = 'Correct-Horse-42';
const from = (n: number) => ({ ...testContext, ipAddress: `198.51.100.${n}` });
const png = Uint8Array.from(
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
		'base64'
	)
);

const subjects = () => vi.mocked(sendEmail).mock.calls.map(([message]) => message.subject);
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);
const exists = async (user: SessionUser) =>
	(await db.select().from(users).where(eq(users.id, user.id))).length === 1;

let jar: TestCookieJar;
let anna: SessionUser;

const ask = (input: object = { currentPassword: password, confirmed: true }) =>
	requestAccountDeletion(anna, jar.headers(), jar, input, testContext, start);

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(email, 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
	await changeUsername(anna.id, 'anna.berg');
	vi.mocked(sendEmail).mockClear();
});

describe('requestAccountDeletion', () => {
	it('schedules the deletion for 30 days on and signs the person out everywhere', async () => {
		const other = new TestCookieJar();
		await logIn({ email, password }, other, from(1));
		const before = jar.headers();

		expect(await ask()).toEqual({ status: 'scheduled', deleteAt: after(30) });

		expect(await getSessionUser(before)).toBeNull();
		expect(await getSessionUser(other.headers())).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(await exists(anna)).toBe(true);
		expect(await actions()).toContain('account_deletion_requested');
		expect(subjects()).toContainEqual(expect.stringMatching(/scheduled for deletion/));
	});

	it('needs the password and the confirmation', async () => {
		expect(await ask({ currentPassword: 'Wrong-Horse-42', confirmed: true })).toEqual({
			status: 'current_password_wrong'
		});
		expect(await ask({ currentPassword: password, confirmed: false })).toEqual({
			status: 'not_confirmed'
		});
		expect(await getSessionUser(jar.headers())).not.toBeNull();
		expect((await db.select().from(users))[0].deletionRequestedAt).toBeNull();
	});
});

describe('signing in during the 30 days', () => {
	it('restores the account, so the daily job leaves it alone', async () => {
		await ask();
		vi.mocked(sendEmail).mockClear();

		expect(await logIn({ email, password }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});

		expect((await db.select().from(users))[0].deletionRequestedAt).toBeNull();
		expect(await actions()).toContain('account_deletion_cancelled');
		expect(subjects()).toContainEqual(expect.stringMatching(/will not be deleted/));

		expect((await runDailyJob(after(40))).accountsDeleted).toBe(0);
		expect(await exists(anna)).toBe(true);
	});
});

describe('the daily job', () => {
	it('leaves an account alone until its 30 days are up', async () => {
		await ask();

		expect((await runDailyJob(after(29.9))).accountsDeleted).toBe(0);
		expect(await exists(anna)).toBe(true);
	});

	it('then removes the user and every row tied to them', async () => {
		await requestPasswordReset(email, from(1));
		const image = ((await setAvatar(anna.id, png)) as { image: string }).image;
		await ask();
		vi.mocked(sendEmail).mockClear();

		expect((await runDailyJob(after(30.1))).accountsDeleted).toBe(1);

		expect(await exists(anna)).toBe(false);
		expect(await db.select().from(accounts)).toHaveLength(0);
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(await db.select().from(consents)).toHaveLength(0);
		expect(await db.select().from(verifications)).toHaveLength(0);
		expect(await readAvatar(image.split('/').pop()!)).toBeNull();
		expect(subjects()).toContainEqual(expect.stringMatching(/has been deleted/));
		expect(await logIn({ email, password }, new TestCookieJar(), from(2))).toEqual({
			status: 'invalid'
		});
	});

	it('keeps the audit entries, but with no user link, address or device', async () => {
		await ask();
		const before = (await db.select().from(auditEvents)).length;

		await runDailyJob(after(31));

		const events = await db.select().from(auditEvents).orderBy(auditEvents.id);
		expect(events.length).toBe(before + 1);
		expect(events.at(-1)?.action).toBe('account_deleted');
		for (const event of events) {
			expect(event.actorUserId).toBeNull();
			expect(event.subjectUserId).toBeNull();
			expect(event.ipAddress).toBeNull();
			expect(event.userAgent).toBeNull();
		}
		expect(JSON.stringify(events)).not.toContain(email);
	});

	it('holds the username for good, so nobody can register it again', async () => {
		await ask();
		await runDailyJob(after(31));

		const [hold] = await db.select().from(usernameHolds);
		expect(hold).toMatchObject({ username: 'anna.berg', userId: null, releaseAt: null });
		expect(await checkUsernameAvailable('Anna.Berg', null, after(5000))).toEqual({
			available: false,
			reason: 'taken'
		});
		expect(
			await signUp(
				{
					name: 'Impostor',
					email: 'impostor@example.com',
					password,
					username: 'anna.berg',
					acceptTerms: true
				},
				from(3)
			)
		).toEqual({ ok: false, errors: { username: 'username_taken' } });
		// The permanent hold survives later runs of the job.
		await runDailyJob(after(200));
		expect(await db.select().from(usernameHolds)).toHaveLength(1);
	});

	it('lets other modules clean up, and leaves other people untouched', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const cleaned: string[] = [];
		onUserDeleted((userId) => void cleaned.push(userId));
		await ask();

		await runDailyJob(after(31));

		expect(cleaned).toEqual([anna.id]);
		expect(await getSessionUser(boJar.headers())).toMatchObject({ email: 'bo@example.com' });
		expect(await db.select().from(users)).toHaveLength(1);
	});

	it('releases username holds whose 30 days are up', async () => {
		await changeUsername(anna.id, 'anna.b', start);

		expect((await runDailyJob(after(29))).usernameHoldsReleased).toBe(0);
		expect((await runDailyJob(after(31))).usernameHoldsReleased).toBe(1);
		expect(await db.select().from(usernameHolds)).toHaveLength(0);
	});

	it('clears expired links and keeps live ones', async () => {
		await requestPasswordReset(email, from(1));
		await requestPasswordReset('anna@example.com', from(2));
		await db.execute(
			sql`update verifications set expires_at = now() - interval '1 minute' where id = (select id from verifications limit 1)`
		);

		expect((await runDailyJob(new Date())).expiredLinksCleared).toBe(1);
		expect(await db.select().from(verifications)).toHaveLength(1);
	});

	it('deletes audit entries older than 12 months and keeps newer ones', async () => {
		await db.execute(sql`
			insert into audit_events (action, created_at) values
				('old', ${new Date('2025-10-01T00:00:00Z').toISOString()}::timestamptz),
				('recent', ${new Date('2025-11-01T00:00:00Z').toISOString()}::timestamptz)
		`);

		const result = await runDailyJob(start);

		expect(result.auditEntriesDeleted).toBe(1);
		const remaining = await actions();
		expect(remaining).toContain('recent');
		expect(remaining).not.toContain('old');
	});

	it('clears attempt counters that have gone quiet', async () => {
		await db.insert(rateLimits).values([
			{ id: 'a', key: 'stale', count: 3, lastRequest: start.getTime() - 3 * DAY },
			{ id: 'b', key: 'fresh', count: 3, lastRequest: start.getTime() - 3600_000 }
		]);

		expect((await runDailyJob(start)).countersCleared).toBe(1);
		const keys = (await db.select().from(rateLimits)).map((row) => row.key);
		expect(keys).toContain('fresh');
		expect(keys).not.toContain('stale');
	});

	it('is safe to run twice', async () => {
		await ask();
		await runDailyJob(after(31));

		expect(await runDailyJob(after(31))).toEqual({
			accountsDeleted: 0,
			usernameHoldsReleased: 0,
			expiredLinksCleared: 0,
			auditEntriesDeleted: 0,
			countersCleared: 0
		});
	});
});
