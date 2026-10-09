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
