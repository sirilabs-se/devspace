import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	createUnverifiedUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { logIn, logOut } from './log-in';
import { auditEvents, sessions } from './schema';
import { getSessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const password = 'Correct-Horse-42';
const DAY = 24 * 60 * 60 * 1000;

const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);

beforeEach(async () => {
	await resetDatabase();
	// Verified, then signed out again, so each test starts with no session.
	const jar = await createSignedInUser(email, 'Anna Berg');
	await logOut(jar.headers(), jar, testContext);
	await db.delete(sessions);
});

describe('logIn', () => {
	it('signs in with the right email and password', async () => {
		const jar = new TestCookieJar();

		const result = await logIn({ email: ' Anna@Example.com ', password }, jar, testContext);

		expect(result).toEqual({ status: 'signed_in' });
		expect(await getSessionUser(jar.headers())).toMatchObject({ email, name: 'Anna Berg' });
		expect((await actions()).at(-1)).toBe('login');
	});

	it('gives exactly the same answer for a wrong password and an unknown email', async () => {
		const wrongPasswordJar = new TestCookieJar();
		const unknownEmailJar = new TestCookieJar();

		const wrongPassword = await logIn(
			{ email, password: 'Wrong-Horse-42' },
			wrongPasswordJar,
			testContext
		);
		const unknownEmail = await logIn(
			{ email: 'nobody@example.com', password },
			unknownEmailJar,
			testContext
		);

		expect(wrongPassword).toEqual({ status: 'invalid' });
		expect(unknownEmail).toEqual(wrongPassword);
		expect(wrongPasswordJar.size).toBe(0);
		expect(unknownEmailJar.size).toBe(0);
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('records failed attempts without the password', async () => {
		await logIn({ email, password: 'Wrong-Horse-42' }, new TestCookieJar(), testContext);

		const [event] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'login_failed'));
		expect(event.actorUserId).toBeNull();
		expect(event.subjectUserId).not.toBeNull();
		expect(JSON.stringify(event)).not.toContain('Wrong-Horse-42');
	});

	it('says "unverified" only when the password is right', async () => {
		await createUnverifiedUser('bo@example.com', 'Bo Lind');

		const rightPassword = new TestCookieJar();
		expect(await logIn({ email: 'bo@example.com', password }, rightPassword, testContext)).toEqual({
			status: 'unverified'
		});
		expect(rightPassword.size).toBe(0);

		expect(
			await logIn(
				{ email: 'bo@example.com', password: 'Wrong-Horse-42' },
				new TestCookieJar(),
				testContext
			)
		).toEqual({ status: 'invalid' });
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('copes with missing or malformed input', async () => {
		for (const input of [
			null,
			{},
			{ email },
			{ email: 'not-an-email', password },
			{ email, password: '' }
		]) {
			expect(await logIn(input, new TestCookieJar(), testContext)).toEqual({ status: 'invalid' });
		}
	});

	it('keeps a session for a day without "remember me", in a cookie that ends with the browser', async () => {
		const jar = new TestCookieJar();
		await logIn({ email, password, rememberMe: false }, jar, testContext);

		const [session] = await db.select().from(sessions);
		const lifetime = session.expiresAt.getTime() - Date.now();
		expect(lifetime).toBeGreaterThan(0.9 * DAY);
		expect(lifetime).toBeLessThan(1.1 * DAY);

		const cookie = [...jar.options].find(([name]) => name.includes('session_token'))!;
		expect(cookie[1].maxAge).toBeUndefined();
		expect(cookie[1].httpOnly).toBe(true);
	});

	it('keeps a session for 30 days with "remember me"', async () => {
		const jar = new TestCookieJar();
		await logIn({ email, password, rememberMe: true }, jar, testContext);

		const [session] = await db.select().from(sessions);
		const lifetime = session.expiresAt.getTime() - Date.now();
		expect(lifetime).toBeGreaterThan(29.9 * DAY);
		expect(lifetime).toBeLessThan(30.1 * DAY);

		const cookie = [...jar.options].find(([name]) => name.includes('session_token'))!;
		expect(cookie[1].maxAge).toBe(30 * 24 * 60 * 60);
	});
});

describe('login lockout', () => {
	const start = Date.UTC(2026, 9, 10, 12, 0, 0);
	const MINUTE = 60 * 1000;
	const wrong = 'Wrong-Horse-42';
	const from = (n: number) => ({ ...testContext, ipAddress: `198.51.100.${n % 250}` });
	let attempts = 0;
	const tryAt = (time: number, pass: string, address = email) =>
		logIn({ email: address, password: pass }, new TestCookieJar(), from(attempts++), time);

	it('refuses the sixth attempt after five failures, even with the right password', async () => {
		for (let failure = 0; failure < 5; failure++) {
			expect(await tryAt(start, wrong)).toEqual({ status: 'invalid' });
		}

		expect(await tryAt(start + 1000, password)).toEqual({ status: 'invalid' });
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect((await actions()).at(-1)).toBe('login_locked_out');
	});

	it('lets the right password in again once the one-minute wait is over', async () => {
		for (let failure = 0; failure < 5; failure++) await tryAt(start, wrong);

		expect(await tryAt(start + MINUTE - 1000, password)).toEqual({ status: 'invalid' });
		expect(await tryAt(start + MINUTE + 1000, password)).toEqual({ status: 'signed_in' });
	});

	it('doubles the wait with each further failure, up to 15 minutes', async () => {
		let time = start;
		for (let failure = 0; failure < 5; failure++) await tryAt(time, wrong);

		for (const waitMinutes of [1, 2, 4, 8, 15, 15]) {
			// Still locked just before the wait ends...
			expect(
				await tryAt(time + waitMinutes * MINUTE - 1000, password),
				`${waitMinutes} min`
			).toEqual({
				status: 'invalid'
			});
			// ...and a wrong password just after it starts the next, longer wait.
			time += waitMinutes * MINUTE + 1000;
			expect(await tryAt(time, wrong)).toEqual({ status: 'invalid' });
		}
	});

	it('does not count attempts made during the wait', async () => {
		for (let failure = 0; failure < 5; failure++) await tryAt(start, wrong);
		for (let attempt = 0; attempt < 20; attempt++) await tryAt(start + 1000, wrong);

		expect(await tryAt(start + MINUTE + 1000, password)).toEqual({ status: 'signed_in' });
	});

	it('forgets earlier failures after a successful login', async () => {
		for (let failure = 0; failure < 4; failure++) await tryAt(start, wrong);
		expect(await tryAt(start, password)).toEqual({ status: 'signed_in' });

		for (let failure = 0; failure < 4; failure++) await tryAt(start + 1000, wrong);
		expect(await tryAt(start + 2000, password)).toEqual({ status: 'signed_in' });
	});

	it('forgets failures after a quiet day', async () => {
		for (let failure = 0; failure < 4; failure++) await tryAt(start, wrong);

		const nextDay = start + 25 * 60 * MINUTE;
		expect(await tryAt(nextDay, wrong)).toEqual({ status: 'invalid' });
		expect(await tryAt(nextDay + 1000, password)).toEqual({ status: 'signed_in' });
	});

	it('behaves the same for an email with no account, and keeps emails apart', async () => {
		for (let failure = 0; failure < 5; failure++) await tryAt(start, wrong, 'nobody@example.com');

		expect(await tryAt(start + 1000, wrong, 'nobody@example.com')).toEqual({ status: 'invalid' });
		expect((await actions()).at(-1)).toBe('login_locked_out');
		expect(await tryAt(start + 1000, password)).toEqual({ status: 'signed_in' });
	});
});

describe('login attempts from one network address', () => {
	it('are refused after 30 in 15 minutes, whatever the email', async () => {
		const start = Date.UTC(2026, 9, 10, 12, 0, 0);
		for (let attempt = 0; attempt < 30; attempt++) {
			const result = await logIn(
				{ email: `guess${attempt}@example.com`, password: 'Wrong-Horse-42' },
				new TestCookieJar(),
				testContext,
				start
			);
			expect(result).toEqual({ status: 'invalid' });
		}

		const refused = await logIn(
			{ email, password },
			new TestCookieJar(),
			testContext,
			start + 1000
		);
		expect(refused).toMatchObject({ status: 'rate_limited' });

		const elsewhere = { ...testContext, ipAddress: '198.51.100.7' };
		expect(await logIn({ email, password }, new TestCookieJar(), elsewhere, start + 1000)).toEqual({
			status: 'signed_in'
		});

		const later = start + 15 * 60 * 1000 + 1000;
		expect(await logIn({ email, password }, new TestCookieJar(), testContext, later)).toEqual({
			status: 'signed_in'
		});
	});
});

describe('sessions', () => {
	it('end once they pass their expiry', async () => {
		const jar = new TestCookieJar();
		await logIn({ email, password, rememberMe: true }, jar, testContext);

		await db.execute(sql`update sessions set expires_at = now() - interval '1 minute'`);

		expect(await getSessionUser(jar.headers())).toBeNull();
	});

	it('end 90 days after they started, however recently they were used', async () => {
		const jar = new TestCookieJar();
		await logIn({ email, password, rememberMe: true }, jar, testContext);
		expect(await getSessionUser(jar.headers())).not.toBeNull();

		await db.execute(sql`update sessions set created_at = now() - interval '91 days'`);

		expect(await getSessionUser(jar.headers(), jar)).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
	});
});

describe('logOut', () => {
	it('ends the session and records it', async () => {
		const jar = new TestCookieJar();
		await logIn({ email, password }, jar, testContext);
		const before = jar.headers();

		await logOut(before, jar, testContext);

		expect(await getSessionUser(before)).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect((await actions()).at(-1)).toBe('logout');
	});

	it('does nothing harmful when nobody is signed in', async () => {
		await expect(logOut(new Headers(), new TestCookieJar(), testContext)).resolves.toBeUndefined();
	});
});
