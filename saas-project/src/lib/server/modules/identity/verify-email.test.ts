import { createEmailVerificationToken } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createUnverifiedUser,
	TestCookieJar,
	testContext,
	verificationTokenFor
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { auditEvents, sessions, users } from './schema';
import { getSessionUser } from './session';
import { resendVerificationEmail, verifyEmail } from './verify-email';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const TEST_SECRET = 'test-only-secret-not-used-anywhere-else';
const ONE_DAY = 60 * 60 * 24;

const verificationEmails = () =>
	vi.mocked(sendEmail).mock.calls.filter(([message]) => message.text.includes('/verify-email?'));

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
	await createUnverifiedUser(email, 'Anna Berg');
});

describe('verifyEmail', () => {
	it('confirms the address, signs the person in and records it', async () => {
		const jar = new TestCookieJar();

		const result = await verifyEmail(verificationTokenFor(email), jar, testContext);

		expect(result).toEqual({ status: 'verified' });
		const [user] = await db.select().from(users);
		expect(user.emailVerified).toBe(true);
		expect(await db.select().from(sessions)).toHaveLength(1);

		const signedIn = await getSessionUser(jar.headers());
		expect(signedIn).toMatchObject({ id: user.id, name: 'Anna Berg', email, emailVerified: true });

		const events = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'email_verified'));
		expect(events).toHaveLength(1);
		expect(events[0].subjectUserId).toBe(user.id);
	});

	it('works only once: a used link signs nobody in', async () => {
		const token = verificationTokenFor(email);
		await verifyEmail(token, new TestCookieJar(), testContext);

		const jar = new TestCookieJar();
		const result = await verifyEmail(token, jar, testContext);

		expect(result).toEqual({ status: 'invalid' });
		expect(jar.size).toBe(0);
		expect(await db.select().from(sessions)).toHaveLength(1);
	});

	it('accepts a link just inside 24 hours and refuses one that has expired', async () => {
		const almostExpired = await createEmailVerificationToken(TEST_SECRET, email, undefined, 60);
		const expired = await createEmailVerificationToken(TEST_SECRET, email, undefined, -60);

		const jar = new TestCookieJar();
		expect(await verifyEmail(expired, jar, testContext)).toEqual({ status: 'expired' });
		expect(jar.size).toBe(0);
		expect((await db.select().from(users))[0].emailVerified).toBe(false);

		expect(await verifyEmail(almostExpired, new TestCookieJar(), testContext)).toEqual({
			status: 'verified'
		});
	});

	it('sends links that last 24 hours', async () => {
		const token = verificationTokenFor(email);
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

		expect(payload.exp - payload.iat).toBe(ONE_DAY);
	});

	it('refuses a malformed link, a forged link and a link for nobody', async () => {
		const forged = await createEmailVerificationToken('some-other-secret', email, undefined, 60);
		const stranger = await createEmailVerificationToken(TEST_SECRET, 'nobody@example.com');

		for (const token of ['', 'not-a-token', forged, stranger, null, 42]) {
			const jar = new TestCookieJar();
			expect(await verifyEmail(token, jar, testContext)).toEqual({ status: 'invalid' });
			expect(jar.size).toBe(0);
		}
		expect((await db.select().from(users))[0].emailVerified).toBe(false);
	});
});

describe('resendVerificationEmail', () => {
	it('sends a new verification email', async () => {
		vi.mocked(sendEmail).mockClear();

		expect(await resendVerificationEmail(' Anna@Example.com ', testContext)).toEqual({
			status: 'sent'
		});

		expect(verificationEmails()).toHaveLength(1);
		expect(verificationEmails()[0][0].to).toBe(email);
	});

	it('refuses a fourth resend within an hour', async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			expect(await resendVerificationEmail(email, testContext)).toEqual({ status: 'sent' });
		}
		vi.mocked(sendEmail).mockClear();

		const result = await resendVerificationEmail(email, testContext);

		expect(result).toMatchObject({ status: 'throttled' });
		expect(result.status === 'throttled' && result.retryAfterSeconds).toBeGreaterThan(3500);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('answers the same way for an address with no account, and sends nothing', async () => {
		vi.mocked(sendEmail).mockClear();

		for (let attempt = 0; attempt < 3; attempt++) {
			expect(await resendVerificationEmail('nobody@example.com', testContext)).toEqual({
				status: 'sent'
			});
		}
		expect(await resendVerificationEmail('nobody@example.com', testContext)).toMatchObject({
			status: 'throttled'
		});
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('sends nothing to an address that is already verified', async () => {
		await verifyEmail(verificationTokenFor(email), new TestCookieJar(), testContext);
		vi.mocked(sendEmail).mockClear();

		expect(await resendVerificationEmail(email, testContext)).toEqual({ status: 'sent' });
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('refuses something that is not an email address', async () => {
		expect(await resendVerificationEmail('not-an-email', testContext)).toEqual({
			status: 'invalid_email'
		});
		expect(await resendVerificationEmail(null, testContext)).toEqual({ status: 'invalid_email' });
	});
});
