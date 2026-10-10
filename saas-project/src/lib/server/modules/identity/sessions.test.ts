import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { logIn } from './log-in';
import { auditEvents, sessions } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { endSession, listActiveSessions } from './sessions';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const password = 'Correct-Horse-42';
const firefoxOnLinux = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';

let jar: TestCookieJar;
let anna: SessionUser;

/** A second browser signed in to the same account. */
async function secondBrowser() {
	const other = new TestCookieJar();
	const result = await logIn({ email, password }, other, {
		ipAddress: '198.51.100.20',
		userAgent: firefoxOnLinux
	});
	expect(result).toEqual({ status: 'signed_in' });
	return other;
}

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(email, 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
});

describe('listActiveSessions', () => {
	it('lists both browsers, this one first, with device, address and times', async () => {
		await secondBrowser();

		const list = await listActiveSessions(anna, jar.headers());

		expect(list).toHaveLength(2);
		expect(list[0]).toMatchObject({ current: true, ipAddress: '203.0.113.5' });
		expect(list[1]).toMatchObject({
			current: false,
			device: 'Firefox on Linux',
			ipAddress: '198.51.100.20'
		});
		expect(list[1].signedInAt).toBeInstanceOf(Date);
		expect(list[1].lastActiveAt).toBeInstanceOf(Date);
		// Nothing that could be used to take a session over is included.
		expect(Object.keys(list[0]).sort()).toEqual([
			'current',
			'device',
			'id',
			'ipAddress',
			'lastActiveAt',
			'signedInAt'
		]);
	});

	it('leaves out expired sessions and other people’s', async () => {
		const other = await secondBrowser();
		await createSignedInUser('bo@example.com', 'Bo Lind');
		const otherId = (await listActiveSessions(anna, jar.headers()))[1].id;
		await db.execute(
			sql`update sessions set expires_at = now() - interval '1 minute' where id = ${otherId}`
		);

		const list = await listActiveSessions(anna, jar.headers());

		expect(list).toHaveLength(1);
		expect(list[0].current).toBe(true);
		expect(await getSessionUser(other.headers())).toBeNull();
	});

	it('refuses a session that isn’t the acting user’s', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');

		await expect(listActiveSessions(anna, boJar.headers())).rejects.toThrow(/does not belong/);
	});
});

describe('endSession', () => {
	it('signs the other browser out and leaves this one signed in', async () => {
		const other = await secondBrowser();
		const otherId = (await listActiveSessions(anna, jar.headers()))[1].id;

		expect(await endSession(anna, jar.headers(), otherId, testContext)).toEqual({
			status: 'ended'
		});

		expect(await getSessionUser(other.headers())).toBeNull();
		expect(await getSessionUser(jar.headers())).toMatchObject({ email });
		expect(await listActiveSessions(anna, jar.headers())).toHaveLength(1);
		const events = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'session_ended'));
		expect(events).toHaveLength(1);
	});

	it('does not end the session making the request', async () => {
		const currentId = (await listActiveSessions(anna, jar.headers()))[0].id;

		expect(await endSession(anna, jar.headers(), currentId, testContext)).toEqual({
			status: 'is_current'
		});
		expect(await getSessionUser(jar.headers())).not.toBeNull();
	});

	it('cannot end another person’s session', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;
		const boSessionId = (await listActiveSessions(bo, boJar.headers()))[0].id;

		expect(await endSession(anna, jar.headers(), boSessionId, testContext)).toEqual({
			status: 'not_found'
		});
		expect(await getSessionUser(boJar.headers())).toMatchObject({ email: 'bo@example.com' });
		expect(await db.select().from(sessions)).toHaveLength(2);

		// Nor by claiming to be them with one's own session.
		await expect(endSession(bo, jar.headers(), boSessionId, testContext)).rejects.toThrow(
			/does not belong/
		);
	});

	it('says so for a session that doesn’t exist', async () => {
		expect(await endSession(anna, jar.headers(), 'made-up', testContext)).toEqual({
			status: 'not_found'
		});
		expect(await endSession(anna, jar.headers(), null, testContext)).toEqual({
			status: 'not_found'
		});
	});
});
