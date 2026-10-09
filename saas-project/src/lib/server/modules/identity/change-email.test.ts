import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	TestCookieJar,
	testContext,
	undoTokenFor,
	verificationTokenFor
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { canUndoEmailChange, requestEmailChange, undoEmailChange } from './change-email';
import { logIn } from './log-in';
import { auditEvents, sessions, users, verifications } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { verifyEmail } from './verify-email';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const oldEmail = 'anna@example.com';
const newEmail = 'anna.berg@example.org';
const password = 'Correct-Horse-42';
const DAY = 24 * 60 * 60 * 1000;
const from = (n: number) => ({ ...testContext, ipAddress: `198.51.100.${n}` });

const emailsTo = (address: string) =>
	vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter((message) => message.to === address);
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);
const emailOf = async (user: SessionUser) =>
	(await db.select().from(users).where(eq(users.id, user.id)))[0].email;

let jar: TestCookieJar;
let anna: SessionUser;

const request = (input: object) => requestEmailChange(anna, jar.headers(), input, testContext);

/** Requests the change and opens the link sent to the new address. */
async function changeEmail() {
	await request({ newEmail, currentPassword: password });
	return verifyEmail(verificationTokenFor(newEmail), jar, testContext);
}

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(oldEmail, 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
	vi.mocked(sendEmail).mockClear();
});

describe('requestEmailChange', () => {
	it('sends a link to the new address and changes nothing yet', async () => {
		expect(
			await request({ newEmail: ' Anna.Berg@Example.org ', currentPassword: password })
		).toEqual({
			status: 'sent'
		});

		expect(await emailOf(anna)).toBe(oldEmail);
		expect(emailsTo(newEmail)).toHaveLength(1);
		expect(emailsTo(newEmail)[0].subject).toMatch(/Confirm your new email/);
		expect(emailsTo(oldEmail)).toHaveLength(0);
		expect(await actions()).toContain('email_change_requested');
	});

	it('needs the current password', async () => {
		expect(await request({ newEmail, currentPassword: 'Wrong-Horse-42' })).toEqual({
			status: 'current_password_wrong'
		});
		expect(await request({ newEmail })).toEqual({ status: 'current_password_wrong' });
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('refuses a malformed address and the address already in use on this account', async () => {
		expect(await request({ newEmail: 'not-an-email', currentPassword: password })).toEqual({
			status: 'invalid_email'
		});
		expect(await request({ newEmail: oldEmail, currentPassword: password })).toEqual({
			status: 'same_email'
		});
	});

	it('gives the same answer for an address another account has, and sends nothing', async () => {
		await createSignedInUser('bo@example.com', 'Bo Lind');
		vi.mocked(sendEmail).mockClear();

		expect(await request({ newEmail: 'bo@example.com', currentPassword: password })).toEqual({
			status: 'sent'
		});

		expect(sendEmail).not.toHaveBeenCalled();
		expect(await emailOf(anna)).toBe(oldEmail);
	});

	it('pauses after three requests in an hour', async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			await request({ newEmail, currentPassword: password });
		}

		expect(await request({ newEmail, currentPassword: password })).toMatchObject({
			status: 'rate_limited'
		});
	});
});

describe('opening the link sent to the new address', () => {
	it('changes the email, after which the new one signs in and the old one doesn’t', async () => {
		expect(await changeEmail()).toEqual({ status: 'verified' });

		expect(await emailOf(anna)).toBe(newEmail);
		expect(await getSessionUser(jar.headers())).toMatchObject({
			email: newEmail,
			emailVerified: true
		});
		expect(await logIn({ email: newEmail, password }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
		expect(await logIn({ email: oldEmail, password }, new TestCookieJar(), from(2))).toEqual({
			status: 'invalid'
		});
	});

	it('tells the old address, with a link to undo it, and records the change', async () => {
		await changeEmail();

		const [notice] = emailsTo(oldEmail);
		expect(notice.subject).toMatch(/email address was changed/);
		expect(notice.text).toMatch(/http:\/\/localhost:5173\/undo-email-change\?token=[0-9a-f]{64}/);
		expect(notice.text).toContain('7 days');
		expect(await actions()).toContain('email_changed');

		// Neither address, nor the undo token, is written into the audit log.
		const log = JSON.stringify(await db.select().from(auditEvents));
		expect(log).not.toContain(oldEmail);
		expect(log).not.toContain(newEmail);
		expect(log).not.toContain(undoTokenFor(oldEmail));
		// The undo token is not stored as it was sent.
		const stored = JSON.stringify(await db.select().from(verifications));
		expect(stored).not.toContain(undoTokenFor(oldEmail));
	});
});

describe('undoEmailChange', () => {
	it('puts the old address back and signs every device out', async () => {
		await changeEmail();
		const token = undoTokenFor(oldEmail);
		expect(await canUndoEmailChange(token)).toBe(true);
		vi.mocked(sendEmail).mockClear();

		expect(await undoEmailChange(token, testContext)).toEqual({ status: 'undone' });

		expect(await emailOf(anna)).toBe(oldEmail);
		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(await logIn({ email: oldEmail, password }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
		expect(await actions()).toContain('email_change_undone');
		expect(emailsTo(oldEmail)[0].subject).toMatch(/was restored/);
	});

	it('works only once', async () => {
		await changeEmail();
		const token = undoTokenFor(oldEmail);
		await undoEmailChange(token, testContext);

		expect(await canUndoEmailChange(token)).toBe(false);
		expect(await undoEmailChange(token, testContext)).toEqual({ status: 'invalid' });
	});

	it('works within 7 days and not after', async () => {
		await changeEmail();
		const token = undoTokenFor(oldEmail);
		const after = (days: number) => new Date(Date.now() + days * DAY);

		expect(await canUndoEmailChange(token, after(6.9))).toBe(true);
		expect(await canUndoEmailChange(token, after(7.1))).toBe(false);
		expect(await undoEmailChange(token, testContext, after(7.1))).toEqual({ status: 'invalid' });
		expect(await emailOf(anna)).toBe(newEmail);
	});

	it('refuses a made-up link', async () => {
		await changeEmail();

		for (const token of ['nonsense', 'a'.repeat(64), '', null]) {
			expect(await canUndoEmailChange(token)).toBe(false);
			expect(await undoEmailChange(token, testContext)).toEqual({ status: 'invalid' });
		}
		expect(await emailOf(anna)).toBe(newEmail);
	});

	it('does not take the old address away from someone who has registered it since', async () => {
		await changeEmail();
		const token = undoTokenFor(oldEmail);
		await createSignedInUser(oldEmail, 'New Owner');

		expect(await undoEmailChange(token, testContext)).toEqual({ status: 'unavailable' });
		expect(await emailOf(anna)).toBe(newEmail);
	});

	it('leaves other people’s accounts and sessions alone', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		await changeEmail();

		await undoEmailChange(undoTokenFor(oldEmail), testContext);

		expect(await getSessionUser(boJar.headers())).toMatchObject({ email: 'bo@example.com' });
	});
});
