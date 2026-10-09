import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	resetTokenFor,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { logIn } from './log-in';
import { requestPasswordReset, resetPassword, resetPasswordLinkState } from './password-reset';
import { accounts, auditEvents, sessions, verifications } from './schema';
import { getSessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const oldPassword = 'Correct-Horse-42';
const newPassword = 'Brand-New-Horse-7';

const emails = () => vi.mocked(sendEmail).mock.calls.map(([message]) => message);
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);
const from = (n: number) => ({ ...testContext, ipAddress: `198.51.100.${n}` });

let jar: TestCookieJar;

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(email, 'Anna Berg');
	vi.mocked(sendEmail).mockClear();
});

async function requestAndGetToken(): Promise<string> {
	await requestPasswordReset(email, testContext);
	return resetTokenFor(email);
}

describe('requestPasswordReset', () => {
	it('emails a reset link to a registered address', async () => {
		expect(await requestPasswordReset(' Anna@Example.com ', testContext)).toEqual({
			status: 'sent'
		});

		expect(emails()).toHaveLength(1);
		expect(emails()[0].to).toBe(email);
		expect(emails()[0].text).toMatch(/http:\/\/localhost:5173\/reset-password\?token=\S+/);
		expect(await actions()).toContain('password_reset_requested');
	});

	it('gives the same answer for an address with no account, and sends nothing', async () => {
		expect(await requestPasswordReset('nobody@example.com', testContext)).toEqual({
			status: 'sent'
		});

		expect(emails()).toHaveLength(0);
	});

	it('refuses something that is not an email address', async () => {
		expect(await requestPasswordReset('not-an-email', testContext)).toEqual({
			status: 'invalid_email'
		});
	});

	it('refuses the fourth request in an hour for one email, registered or not', async () => {
		for (const address of [email, 'nobody@example.com']) {
			for (let attempt = 0; attempt < 3; attempt++) {
				expect(await requestPasswordReset(address, from(attempt))).toEqual({ status: 'sent' });
			}
			expect(await requestPasswordReset(address, from(9))).toMatchObject({
				status: 'rate_limited'
			});
		}
	});

	it('refuses the 11th request in an hour from one network address', async () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			await requestPasswordReset(`person${attempt}@example.com`, testContext);
		}

		expect(await requestPasswordReset(email, testContext)).toMatchObject({
			status: 'rate_limited'
		});
		expect(emails()).toHaveLength(0);
	});
});

describe('resetPassword', () => {
	it('sets the new password, so the person can sign in with it and not with the old one', async () => {
		const token = await requestAndGetToken();

		const result = await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		expect(result).toEqual({ status: 'done' });
		expect(await logIn({ email, password: newPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(2))).toEqual({
			status: 'invalid'
		});
	});

	it('ends every session, records the reset and emails a confirmation', async () => {
		const token = await requestAndGetToken();
		vi.mocked(sendEmail).mockClear();

		await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(await actions()).toContain('password_reset');
		expect(emails()).toHaveLength(1);
		expect(emails()[0].subject).toMatch(/password was changed/);

		const all = JSON.stringify(await db.select().from(auditEvents));
		expect(all).not.toContain(newPassword);
		expect(all).not.toContain(token);
	});

	it('stores only a hash of the new password', async () => {
		const token = await requestAndGetToken();
		await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		const [account] = await db.select().from(accounts);
		expect(account.password).not.toContain(newPassword);
	});

	it('works only once', async () => {
		const token = await requestAndGetToken();
		await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		const again = await resetPassword(
			{ token, password: 'Another-Horse-9!', confirmPassword: 'Another-Horse-9!' },
			testContext
		);

		expect(again).toEqual({ status: 'invalid' });
		expect(await resetPasswordLinkState(token)).toBe('invalid');
		expect(await logIn({ email, password: newPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
	});

	it('lasts one hour, and is refused after that', async () => {
		const token = await requestAndGetToken();
		const [link] = await db.select().from(verifications);
		const minutes = (link.expiresAt.getTime() - Date.now()) / 60000;
		expect(minutes).toBeGreaterThan(59);
		expect(minutes).toBeLessThan(61);
		expect(await resetPasswordLinkState(token)).toBe('valid');

		await db.execute(sql`update verifications set expires_at = now() - interval '1 minute'`);

		expect(await resetPasswordLinkState(token)).toBe('expired');
		expect(
			await resetPassword(
				{ token, password: newPassword, confirmPassword: newPassword },
				testContext
			)
		).toEqual({ status: 'expired' });
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
	});

	it('refuses a made-up link', async () => {
		for (const token of ['nonsense', '', null, undefined]) {
			expect(await resetPasswordLinkState(token)).toBe('invalid');
			expect(
				await resetPassword(
					{ token, password: newPassword, confirmPassword: newPassword },
					testContext
				)
			).toEqual({ status: 'invalid' });
		}
	});

	it('refuses a weak password and passwords that differ, leaving the link usable', async () => {
		const token = await requestAndGetToken();

		expect(
			await resetPassword({ token, password: 'sunset', confirmPassword: 'sunset' }, testContext)
		).toEqual({ status: 'password_too_weak' });
		expect(
			await resetPassword(
				{ token, password: newPassword, confirmPassword: 'Other-Horse-9!' },
				testContext
			)
		).toEqual({ status: 'passwords_differ' });

		expect(await resetPasswordLinkState(token)).toBe('valid');
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(1))).toEqual({
			status: 'signed_in'
		});
	});

	it('clears a login lockout', async () => {
		for (let failure = 0; failure < 5; failure++) {
			await logIn({ email, password: 'Wrong-Horse-42' }, new TestCookieJar(), from(failure));
		}
		expect(await logIn({ email, password: oldPassword }, new TestCookieJar(), from(7))).toEqual({
			status: 'invalid'
		});
		const token = await requestAndGetToken();

		await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		expect(await logIn({ email, password: newPassword }, new TestCookieJar(), from(8))).toEqual({
			status: 'signed_in'
		});
	});

	it('leaves other people’s passwords and sessions alone', async () => {
		const bo = await createSignedInUser('bo@example.com', 'Bo Lind');
		const token = await requestAndGetToken();

		await resetPassword(
			{ token, password: newPassword, confirmPassword: newPassword },
			testContext
		);

		expect(await getSessionUser(bo.headers())).toMatchObject({ email: 'bo@example.com' });
		expect(
			await logIn({ email: 'bo@example.com', password: oldPassword }, new TestCookieJar(), from(1))
		).toEqual({ status: 'signed_in' });
		const [event] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'password_reset'));
		expect(event.subjectUserId).not.toBe((await getSessionUser(bo.headers()))!.id);
	});
});
