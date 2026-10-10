import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { createSignedInUser, TestCookieJar } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { recogniseDevice } from './device-recognition';
import { auditEvents } from './schema';
import { getSessionUser, type SessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const context = {
	ipAddress: '198.51.100.20',
	userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
};

const alerts = () =>
	vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter((message) => message.subject.includes('New sign-in'));
const newDeviceEvents = () =>
	db.select().from(auditEvents).where(eq(auditEvents.action, 'login_new_device'));

let anna: SessionUser;

/** Makes the account old enough that a new browser is worth an alert. */
const ageAccounts = () => db.execute(sql`update users set created_at = now() - interval '2 days'`);

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	vi.mocked(sendEmail).mockClear();
});

describe('recogniseDevice', () => {
	it('marks the first browser of a brand-new account without an alert', async () => {
		const browser = new TestCookieJar();

		expect(await recogniseDevice(anna, browser, context)).toBe('first_device');

		expect(alerts()).toHaveLength(0);
		expect(await newDeviceEvents()).toHaveLength(0);
		expect(await recogniseDevice(anna, browser, context)).toBe('known');
	});

	it('emails the owner and records it the first time the account is used on a new browser', async () => {
		await ageAccounts();
		const browser = new TestCookieJar();

		expect(await recogniseDevice(anna, browser, context)).toBe('new_device');

		const [alert] = alerts();
		expect(alert.to).toBe('anna@example.com');
		expect(alert.text).toContain('Firefox on Linux');
		expect(alert.text).toContain('198.51.100.20');
		expect(alert.text).toContain('/settings/security');
		const [event] = await newDeviceEvents();
		expect(event).toMatchObject({ subjectUserId: anna.id, ipAddress: '198.51.100.20' });
	});

	it('still lets the person in when the alert can’t be sent', async () => {
		await ageAccounts();
		const browser = new TestCookieJar();
		const noise = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(sendEmail).mockRejectedValueOnce(new Error('The email server is down'));

		expect(await recogniseDevice(anna, browser, context)).toBe('new_device');

		expect(await newDeviceEvents()).toHaveLength(1);
		expect(await recogniseDevice(anna, browser, context)).toBe('known');
		noise.mockRestore();
	});

	it('sends no further alerts for later visits from that browser', async () => {
		await ageAccounts();
		const browser = new TestCookieJar();
		await recogniseDevice(anna, browser, context);
		vi.mocked(sendEmail).mockClear();

		for (let visit = 0; visit < 3; visit++) {
			expect(await recogniseDevice(anna, browser, context)).toBe('known');
		}

		expect(alerts()).toHaveLength(0);
		expect(await newDeviceEvents()).toHaveLength(1);
	});

	it('alerts again from a different browser', async () => {
		await ageAccounts();
		await recogniseDevice(anna, new TestCookieJar(), context);

		expect(await recogniseDevice(anna, new TestCookieJar(), context)).toBe('new_device');
		expect(alerts()).toHaveLength(2);
	});

	it('keeps accounts apart on a shared browser', async () => {
		const bo = (await getSessionUser(
			(await createSignedInUser('bo@example.com', 'Bo Lind')).headers()
		))!;
		await ageAccounts();
		vi.mocked(sendEmail).mockClear();
		const shared = new TestCookieJar();

		expect(await recogniseDevice(anna, shared, context)).toBe('new_device');
		expect(await recogniseDevice(bo, shared, context)).toBe('new_device');
		expect(await recogniseDevice(anna, shared, context)).toBe('known');
		expect(await recogniseDevice(bo, shared, context)).toBe('known');
		expect(
			alerts()
				.map((alert) => alert.to)
				.sort()
		).toEqual(['anna@example.com', 'bo@example.com']);
	});

	it('treats an altered or made-up cookie as an unknown browser', async () => {
		await ageAccounts();
		const browser = new TestCookieJar();
		await recogniseDevice(anna, browser, context);
		const genuine = browser.get('known_devices')!;
		vi.mocked(sendEmail).mockClear();

		for (const forged of [
			`${genuine.split('.')[0]}.not-the-signature`,
			`${'a'.repeat(24)}.${genuine.split('.')[1]}`,
			'nonsense',
			''
		]) {
			const tampered = new TestCookieJar();
			tampered.set('known_devices', forged);
			expect(await recogniseDevice(anna, tampered, context), forged).toBe('new_device');
		}
	});

	it('keeps the mark in a cookie scripts can’t read, for a year, without the account’s ID in it', async () => {
		const browser = new TestCookieJar();
		await recogniseDevice(anna, browser, context);

		expect(browser.options.get('known_devices')).toMatchObject({
			httpOnly: true,
			maxAge: 365 * 24 * 60 * 60
		});
		expect(browser.get('known_devices')).not.toContain(anna.id);
	});
});
