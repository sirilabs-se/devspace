import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	makeAdmin,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { getUserForAdmin, searchUsers } from './admin';
import { auditEvents } from './schema';
import { getSessionUser, requireRole, type SessionUser } from './session';
import { changeUsername } from './username';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let adminJar: TestCookieJar;
let admin: SessionUser;
let anna: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	adminJar = await createSignedInUser('root@example.com', 'Rita Admin');
	await makeAdmin('root@example.com');
	admin = (await getSessionUser(adminJar.headers()))!;
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	await changeUsername(anna.id, 'anna.berg');
});

describe('roles', () => {
	it('come from the account, and default to an ordinary user', () => {
		expect(admin.role).toBe('admin');
		expect(anna.role).toBe('user');
	});

	it('requireRole lets an admin through and refuses everyone else', () => {
		expect(requireRole(admin, 'admin')).toBe(admin);
		expect(() => requireRole(anna, 'admin')).toThrow(expect.objectContaining({ status: 403 }));
		expect(() => requireRole(null, 'admin')).toThrow(expect.objectContaining({ status: 401 }));
	});

	it('treats an unknown role as an ordinary user', async () => {
		await db.execute(sql`update users set role = 'superuser' where email = 'anna@example.com'`);
		const jar = new TestCookieJar();
		const { logIn } = await import('./log-in');
		await logIn({ email: 'anna@example.com', password: 'Correct-Horse-42' }, jar, testContext);

		expect((await getSessionUser(jar.headers()))?.role).toBe('user');
	});
});

describe('searchUsers', () => {
	it('finds a person by part of their email, name or username, whatever the letter case', async () => {
		for (const query of ['anna@example.com', 'ANNA@', 'berg', 'Anna.B', 'nna b']) {
			const result = await searchUsers(admin, query);
			expect(
				result.users.map((user) => user.email),
				query
			).toEqual(['anna@example.com']);
		}
		const [found] = (await searchUsers(admin, 'anna')).users;
		expect(found).toMatchObject({
			id: anna.id,
			name: 'Anna Berg',
			username: 'anna.berg',
			role: 'user',
			emailVerified: true,
			suspended: false
		});
	});

	it('lists everyone, newest first, for an empty search', async () => {
		const result = await searchUsers(admin, '');

		expect(result.total).toBe(2);
		expect(result.users.map((user) => user.email)).toEqual([
			'anna@example.com',
			'root@example.com'
		]);
	});

	it('returns nothing for a search that matches nobody', async () => {
		expect(await searchUsers(admin, 'zebra')).toMatchObject({ users: [], total: 0, pageCount: 1 });
	});

	it('treats % and _ as ordinary characters, not wildcards', async () => {
		expect((await searchUsers(admin, '%')).total).toBe(0);
		expect((await searchUsers(admin, 'a_na')).total).toBe(0);
	});

	it('shows 25 to a page and keeps the page within range', async () => {
		await db.execute(sql`
			insert into users (id, email, name)
			select 'bulk-' || n, 'bulk' || n || '@example.com', 'Bulk ' || n from generate_series(1, 60) n
		`);

		const first = await searchUsers(admin, 'bulk', 1);
		const third = await searchUsers(admin, 'bulk', 3);

		expect(first).toMatchObject({ total: 60, pageCount: 3, page: 1 });
		expect(first.users).toHaveLength(25);
		expect(third.users).toHaveLength(10);
		expect((await searchUsers(admin, 'bulk', 99)).page).toBe(3);
		expect((await searchUsers(admin, 'bulk', -4)).page).toBe(1);
		expect((await searchUsers(admin, 'bulk', 'nonsense')).page).toBe(1);
		const ids = new Set(
			[...first.users, ...(await searchUsers(admin, 'bulk', 2)).users, ...third.users].map(
				(user) => user.id
			)
		);
		expect(ids.size).toBe(60);
	});

	it('never includes password hashes or other secrets', async () => {
		const result = await searchUsers(admin, '');

		expect(Object.keys(result.users[0]).sort()).toEqual([
			'createdAt',
			'email',
			'emailVerified',
			'id',
			'name',
			'role',
			'suspended',
			'username'
		]);
	});

	it('refuses anyone who is not an admin', async () => {
		await expect(searchUsers(anna, '')).rejects.toMatchObject({ status: 403 });
	});
});

describe('getUserForAdmin', () => {
	it('shows a user’s account details and recent security events, and records the look', async () => {
		const details = await getUserForAdmin(admin, anna.id, testContext);

		expect(details).toMatchObject({
			id: anna.id,
			email: 'anna@example.com',
			username: 'anna.berg',
			role: 'user',
			suspended: false,
			twoStepOn: false,
			hasPassword: true,
			providers: [],
			passkeyCount: 0,
			deletionRequestedAt: null
		});
		expect(details!.recentActivity.map((event) => event.action)).toEqual([
			'email_verified',
			'signup'
		]);

		const [look] = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'admin_viewed_user'));
		expect(look).toMatchObject({ actorUserId: admin.id, subjectUserId: anna.id });
	});

	it('returns nothing for a user that doesn’t exist', async () => {
		expect(await getUserForAdmin(admin, 'no-such-user', testContext)).toBeNull();
	});

	it('refuses anyone who is not an admin, even for their own account', async () => {
		await expect(getUserForAdmin(anna, admin.id, testContext)).rejects.toMatchObject({
			status: 403
		});
		await expect(getUserForAdmin(anna, anna.id, testContext)).rejects.toMatchObject({
			status: 403
		});
	});
});
