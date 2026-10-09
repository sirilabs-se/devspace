import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { listSecurityActivity } from './activity';
import { recordAuditEvent } from './audit';
import { describeDevice } from './device';
import { logIn } from './log-in';
import { getSessionUser, type SessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const chromeOnWindows =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

let anna: SessionUser;
let bo: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;
});

describe('listSecurityActivity', () => {
	it('lists the person’s events newest first, with the time and device', async () => {
		await logIn({ email: 'anna@example.com', password: 'Wrong-Horse-42' }, new TestCookieJar(), {
			ipAddress: '198.51.100.1',
			userAgent: chromeOnWindows
		});
		await logIn({ email: 'anna@example.com', password: 'Correct-Horse-42' }, new TestCookieJar(), {
			ipAddress: '198.51.100.2',
			userAgent: chromeOnWindows
		});

		const activity = await listSecurityActivity(anna.id);

		expect(activity.map((event) => event.action)).toEqual([
			'login',
			'login_failed',
			'email_verified',
			'signup'
		]);
		expect(activity[0]).toMatchObject({
			device: 'Chrome on Windows',
			ipAddress: '198.51.100.2',
			bySelf: true
		});
		expect(activity[1].bySelf).toBe(false);
		expect(activity[0].at).toBeInstanceOf(Date);
		expect(activity[0].at.getTime()).toBeGreaterThanOrEqual(activity[1].at.getTime());
	});

	it('never includes another person’s events', async () => {
		await recordAuditEvent(bo.id, 'password_changed', bo.id, testContext);
		await logIn(
			{ email: 'bo@example.com', password: 'Wrong-Horse-42' },
			new TestCookieJar(),
			testContext
		);

		const annas = await listSecurityActivity(anna.id);
		const bos = await listSecurityActivity(bo.id);

		expect(annas.map((event) => event.action)).toEqual(['email_verified', 'signup']);
		expect(bos.map((event) => event.action)).toContain('password_changed');
		expect(bos.map((event) => event.action)).toContain('login_failed');
	});

	it('returns at most the number asked for, and never more than 200', async () => {
		await db.execute(sql`
			insert into audit_events (subject_user_id, action, created_at)
			select ${anna.id}, 'login', now() - (n || ' minutes')::interval from generate_series(1, 250) n
		`);

		expect(await listSecurityActivity(anna.id)).toHaveLength(50);
		expect(await listSecurityActivity(anna.id, 5)).toHaveLength(5);
		expect(await listSecurityActivity(anna.id, 10_000)).toHaveLength(200);
	});
});

describe('describeDevice', () => {
	it('names the browser and system in plain words', () => {
		expect(describeDevice(chromeOnWindows)).toBe('Chrome on Windows');
		expect(
			describeDevice(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
			)
		).toBe('Safari on iOS');
		expect(
			describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')
		).toBe('Firefox on Linux');
		expect(
			describeDevice(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
			)
		).toBe('Edge on macOS');
	});

	it('copes with nothing or nonsense', () => {
		expect(describeDevice(null)).toBe('Unknown device');
		expect(describeDevice('curl/8.0')).toBe('Unknown device');
	});
});
