import { eq } from 'drizzle-orm';
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
import { getUserForAdmin, reinstateUser, suspendUser } from './admin';
import { logIn } from './log-in';
import { requestPasswordReset } from './password-reset';
import { auditEvents, sessions, users } from './schema';
import { getSessionUser, type SessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const password = 'Correct-Horse-42';
let address = 0;
const from = () => ({ ...testContext, ipAddress: `198.51.100.${(address++ % 200) + 1}` });
const subjects = () => vi.mocked(sendEmail).mock.calls.map(([message]) => message.subject);
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);

let admin: SessionUser;
let annaJar: TestCookieJar;
let anna: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	const adminJar = await createSignedInUser('root@example.com', 'Rita Admin');
	await makeAdmin('root@example.com');
	admin = (await getSessionUser(adminJar.headers()))!;
	annaJar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(annaJar.headers()))!;
	vi.mocked(sendEmail).mockClear();
});

describe('suspendUser', () => {
	it('signs the person out everywhere and tells them why', async () => {
		const other = new TestCookieJar();
		await logIn({ email: 'anna@example.com', password }, other, from());

		expect(await suspendUser(admin, anna.id, 'Spamming event pages', testContext)).toEqual({
			status: 'suspended'
		});

		expect(await getSessionUser(annaJar.headers())).toBeNull();
		expect(await getSessionUser(other.headers())).toBeNull();
		const message = vi
			.mocked(sendEmail)
			.mock.calls.map(([sent]) => sent)
			.at(-1)!;
		expect(message.to).toBe('anna@example.com');
		expect(message.subject).toMatch(/has been suspended/);
		expect(message.text).toContain('Spamming event pages');
	});

	it('stops the person signing in, even with the right password', async () => {
		await suspendUser(admin, anna.id, 'Spamming event pages', testContext);
		const jar = new TestCookieJar();

		expect(await logIn({ email: 'anna@example.com', password }, jar, from())).toEqual({
			status: 'suspended'
		});

		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await db.select().from(sessions).where(eq(sessions.userId, anna.id))).toHaveLength(0);
		// A wrong password still gets the ordinary answer, so nothing is revealed to a stranger.
		expect(
			await logIn(
				{ email: 'anna@example.com', password: 'Wrong-Horse-42' },
				new TestCookieJar(),
				from()
			)
		).toEqual({ status: 'invalid' });
	});

	it('records who suspended whom, without the reason text', async () => {
		await suspendUser(admin, anna.id, 'A reason with a name in it: Bo Lind', testContext);

		const [event] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'user_suspended'));
		expect(event).toMatchObject({ actorUserId: admin.id, subjectUserId: anna.id });
		expect(JSON.stringify(event)).not.toContain('Bo Lind');
		expect((await getUserForAdmin(admin, anna.id, testContext))?.suspensionReason).toContain(
			'Bo Lind'
		);
	});

	it('needs a reason', async () => {
		for (const reason of ['', '   ', null, 'x'.repeat(501)]) {
			expect(await suspendUser(admin, anna.id, reason, testContext)).toEqual({
				status: 'reason_required'
			});
		}
		expect(await getSessionUser(annaJar.headers())).not.toBeNull();
	});

	it('can’t be used on oneself, on another admin, twice, or on nobody', async () => {
		await createSignedInUser('second@example.com', 'Second Admin');
		await makeAdmin('second@example.com');
		const [second] = await db.select().from(users).where(eq(users.email, 'second@example.com'));

		expect(await suspendUser(admin, admin.id, 'Oops', testContext)).toEqual({ status: 'is_self' });
		expect(await suspendUser(admin, second.id, 'Rivalry', testContext)).toEqual({
			status: 'is_admin'
		});
		expect(await suspendUser(admin, 'no-such-user', 'Why', testContext)).toEqual({
			status: 'not_found'
		});
		await suspendUser(admin, anna.id, 'First time', testContext);
		expect(await suspendUser(admin, anna.id, 'Again', testContext)).toEqual({
			status: 'already_suspended'
		});
	});

	it('is refused to anyone who is not an admin', async () => {
		const bo = (await getSessionUser(
			(await createSignedInUser('bo@example.com', 'Bo Lind')).headers()
		))!;

		await expect(suspendUser(anna, bo.id, 'I dislike Bo', testContext)).rejects.toMatchObject({
			status: 403
		});
		await expect(reinstateUser(anna, bo.id, testContext)).rejects.toMatchObject({ status: 403 });
		expect((await db.select().from(users).where(eq(users.id, bo.id)))[0].banned).toBe(false);
	});

	it('still holds after the person resets their password', async () => {
		await suspendUser(admin, anna.id, 'Spamming event pages', testContext);
		await requestPasswordReset('anna@example.com', from());

		expect(
			await logIn({ email: 'anna@example.com', password }, new TestCookieJar(), from())
		).toEqual({
			status: 'suspended'
		});
	});
});

describe('reinstateUser', () => {
	it('lets the person sign in again, tells them, and records it', async () => {
		await suspendUser(admin, anna.id, 'Spamming event pages', testContext);
		vi.mocked(sendEmail).mockClear();

		expect(await reinstateUser(admin, anna.id, testContext)).toEqual({ status: 'reinstated' });

		const jar = new TestCookieJar();
		expect(await logIn({ email: 'anna@example.com', password }, jar, from())).toEqual({
			status: 'signed_in'
		});
		expect(await getSessionUser(jar.headers())).toMatchObject({ email: 'anna@example.com' });
		expect(subjects()).toContainEqual(expect.stringMatching(/has been reinstated/));
		expect(await actions()).toContain('user_reinstated');
		expect((await getUserForAdmin(admin, anna.id, testContext))?.suspensionReason).toBeNull();
	});

	it('says so when the account isn’t suspended or doesn’t exist', async () => {
		expect(await reinstateUser(admin, anna.id, testContext)).toEqual({ status: 'not_suspended' });
		expect(await reinstateUser(admin, 'no-such-user', testContext)).toEqual({
			status: 'not_found'
		});
	});
});
