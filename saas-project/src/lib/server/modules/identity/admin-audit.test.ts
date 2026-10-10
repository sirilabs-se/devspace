import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	makeAdmin,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { suspendUser } from './admin';
import { exportAuditEvents, listAuditEvents } from './admin-audit';
import { recordAuditEvent } from './audit';
import { logIn } from './log-in';
import { auditEvents } from './schema';
import { getSessionUser, type SessionUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let admin: SessionUser;
let anna: SessionUser;
let bo: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	admin = (await getSessionUser(
		(await createSignedInUser('root@example.com', 'Rita Admin')).headers()
	))!;
	await makeAdmin('root@example.com');
	admin = { ...admin, role: 'admin' };
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;
	await logIn({ email: 'anna@example.com', password: 'Wrong-Horse-42' }, new TestCookieJar(), {
		ipAddress: '198.51.100.7',
		userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
	});
	await suspendUser(admin, bo.id, 'Spamming', testContext);
});

describe('listAuditEvents', () => {
	it('lists every entry, newest first, with who acted and whom it concerns', async () => {
		const result = await listAuditEvents(admin, {});

		expect(result.total).toBe(8);
		expect(result.entries[0]).toMatchObject({
			action: 'user_suspended',
			actor: { id: admin.id, name: 'Rita Admin', email: 'root@example.com' },
			subject: { id: bo.id, email: 'bo@example.com' }
		});
		expect(result.entries[1]).toMatchObject({
			action: 'login_failed',
			actor: null,
			subject: { email: 'anna@example.com' },
			ipAddress: '198.51.100.7',
			device: 'Firefox on Linux'
		});
		const times = result.entries.map((entry) => entry.at.getTime());
		expect(times).toEqual([...times].sort((a, b) => b - a));
		expect(result.actions).toEqual(['email_verified', 'login_failed', 'signup', 'user_suspended']);
	});

	it('filters by person: anyone who acted or was acted on', async () => {
		const annas = await listAuditEvents(admin, { user: 'anna@' });
		const admins = await listAuditEvents(admin, { user: 'Rita' });

		expect(annas.entries.map((entry) => entry.action)).toEqual([
			'login_failed',
			'email_verified',
			'signup'
		]);
		// The admin's own sign-up and verification, plus the suspension they carried out.
		expect(admins.entries.map((entry) => entry.action)).toEqual([
			'user_suspended',
			'email_verified',
			'signup'
		]);
		expect((await listAuditEvents(admin, { user: 'nobody-like-this' })).total).toBe(0);
	});

	it('filters by action', async () => {
		const result = await listAuditEvents(admin, { action: 'signup' });

		expect(result.total).toBe(3);
		expect(result.entries.every((entry) => entry.action === 'signup')).toBe(true);
	});

	it('filters by date, including the whole of the last day', async () => {
		await db.execute(sql`
			insert into audit_events (action, created_at) values
				('old_event', '2026-03-01T23:59:59Z'),
				('old_event', '2026-03-02T00:00:00Z'),
				('old_event', '2026-03-03T12:00:00Z')
		`);
		const count = async (from?: string, to?: string) =>
			(await listAuditEvents(admin, { action: 'old_event', from, to })).total;

		expect(await count('2026-03-02', '2026-03-02')).toBe(1);
		expect(await count('2026-03-01', '2026-03-02')).toBe(2);
		expect(await count('2026-03-02')).toBe(2);
		expect(await count(undefined, '2026-03-01')).toBe(1);
		// A date that makes no sense is ignored, not an error.
		expect(await count('not-a-date', '2026-13-45')).toBe(3);
	});

	it('combines filters', async () => {
		const result = await listAuditEvents(admin, { user: 'anna', action: 'login_failed' });

		expect(result.entries).toHaveLength(1);
	});

	it('shows 25 to a page', async () => {
		await db.execute(sql`
			insert into audit_events (action, created_at)
			select 'bulk', now() - (n || ' seconds')::interval from generate_series(1, 60) n
		`);

		const first = await listAuditEvents(admin, { action: 'bulk' }, 1);
		const last = await listAuditEvents(admin, { action: 'bulk' }, 3);

		expect(first).toMatchObject({ total: 60, pageCount: 3, page: 1 });
		expect(first.entries).toHaveLength(25);
		expect(last.entries).toHaveLength(10);
		expect((await listAuditEvents(admin, { action: 'bulk' }, 99)).page).toBe(3);
	});

	it('is refused to anyone who is not an admin', async () => {
		await expect(listAuditEvents(anna, {})).rejects.toMatchObject({ status: 403 });
	});
});

describe('exportAuditEvents', () => {
	it('gives the filtered entries as CSV, and records that an export was made', async () => {
		const { csv, count } = await exportAuditEvents(admin, { user: 'anna' }, testContext);

		const lines = csv.trim().split('\r\n');
		expect(count).toBe(3);
		expect(lines).toHaveLength(4);
		expect(lines[0]).toBe(
			'"Time (UTC)","Action","By","By email","About","About email","Network address","Device","Details"'
		);
		expect(lines[1]).toContain('"login_failed"');
		expect(lines[1]).toContain('"anna@example.com"');
		expect(lines[1]).toContain('"198.51.100.7"');
		expect(lines[1]).toMatch(/^"\d{4}-\d{2}-\d{2}T[\d:.]+Z"/);

		const [exported] = (await listAuditEvents(admin, { action: 'audit_log_exported' })).entries;
		expect(exported).toMatchObject({ actor: { id: admin.id }, details: { entries: 3 } });
	});

	it('quotes every cell, and never lets one start a spreadsheet formula', async () => {
		await recordAuditEvent(null, '=HYPERLINK("http://evil.example")', null, {
			details: { note: 'said "hi", then left' }
		});

		const { csv } = await exportAuditEvents(
			admin,
			{ action: '=HYPERLINK("http://evil.example")' },
			testContext
		);
		const row = csv.trim().split('\r\n')[1];

		expect(row).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
		expect(row).toContain('"{""note"":""said \\""hi\\"", then left""}"');
	});

	it('gives just the heading when nothing matches', async () => {
		const { csv, count } = await exportAuditEvents(
			admin,
			{ user: 'nobody-like-this' },
			testContext
		);

		expect(count).toBe(0);
		expect(csv.trim().split('\r\n')).toHaveLength(1);
	});

	it('leaves the log exactly as it was, apart from noting the export', async () => {
		const before = await db.select().from(auditEvents).orderBy(auditEvents.id);

		await exportAuditEvents(admin, {}, testContext);

		const after = await db.select().from(auditEvents).orderBy(auditEvents.id);
		expect(after.slice(0, before.length)).toEqual(before);
		expect(after).toHaveLength(before.length + 1);
	});

	it('is refused to anyone who is not an admin', async () => {
		await expect(exportAuditEvents(anna, {}, testContext)).rejects.toMatchObject({ status: 403 });
	});
});
