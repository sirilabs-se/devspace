import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { recordAuditEvent } from './audit';
import { auditEvents, users } from './schema';
import { toUserId } from './user-id';

const userId = toUserId('user-1');

beforeEach(async () => {
	await resetDatabase();
	await db.insert(users).values({ id: userId, email: 'anna@example.com', name: 'Anna' });
});

/** Drizzle wraps database errors; the trigger's message is on the cause. */
async function databaseError(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
	} catch (error) {
		return String((error as { cause?: unknown }).cause ?? error);
	}
	return 'no error';
}

describe('recordAuditEvent', () => {
	it('appends an entry', async () => {
		await recordAuditEvent(userId, 'login', userId, {
			ipAddress: '203.0.113.5',
			userAgent: 'Test Browser',
			details: { method: 'password' }
		});

		const [event] = await db.select().from(auditEvents);
		expect(event).toMatchObject({
			actorUserId: userId,
			subjectUserId: userId,
			action: 'login',
			details: { method: 'password' },
			ipAddress: '203.0.113.5',
			userAgent: 'Test Browser'
		});
		expect(event.createdAt).toBeInstanceOf(Date);
	});

	it('accepts an entry with nobody signed in', async () => {
		await recordAuditEvent(null, 'login_failed', null);

		const [event] = await db.select().from(auditEvents);
		expect(event).toMatchObject({ actorUserId: null, subjectUserId: null, details: null });
	});
});

describe('the audit log in the database', () => {
	beforeEach(async () => {
		await recordAuditEvent(userId, 'login', userId, { ipAddress: '203.0.113.5' });
	});

	it('rejects changing what an entry says', async () => {
		const error = await databaseError(() => db.update(auditEvents).set({ action: 'logout' }));

		expect(error).toContain('audit_events rows cannot be edited');
		const [event] = await db.select().from(auditEvents);
		expect(event.action).toBe('login');
	});

	it('rejects changing the details, the time or who it is about', async () => {
		await db.insert(users).values({ id: 'user-2', email: 'bo@example.com', name: 'Bo' });

		for (const change of [
			{ details: { forged: true } },
			{ createdAt: new Date('2020-01-01') },
			{ subjectUserId: 'user-2' },
			{ ipAddress: '198.51.100.1' }
		]) {
			const error = await databaseError(() => db.update(auditEvents).set(change));
			expect(error).toContain('audit_events rows cannot be edited');
		}
	});

	it('rejects deleting a recent entry', async () => {
		const error = await databaseError(() => db.delete(auditEvents));

		expect(error).toContain('can only be deleted after 12 months');
		expect(await db.select().from(auditEvents)).toHaveLength(1);
	});

	it('keeps the entry, without the user link, when the user is deleted', async () => {
		await db.delete(users).where(eq(users.id, userId));

		const [event] = await db.select().from(auditEvents);
		expect(event).toMatchObject({ actorUserId: null, subjectUserId: null, action: 'login' });
	});

	it('allows emptying the IP address and device details', async () => {
		await db.update(auditEvents).set({ ipAddress: null, userAgent: null });

		const [event] = await db.select().from(auditEvents);
		expect(event.ipAddress).toBeNull();
	});

	it('allows deleting an entry older than 12 months', async () => {
		// Only a trigger-free insert can create an old entry; the guard covers updates and deletes.
		await db.execute(
			sql`insert into audit_events (action, created_at) values ('old', now() - interval '13 months')`
		);

		await db.delete(auditEvents).where(eq(auditEvents.action, 'old'));

		expect(await db.select().from(auditEvents)).toHaveLength(1);
	});
});
