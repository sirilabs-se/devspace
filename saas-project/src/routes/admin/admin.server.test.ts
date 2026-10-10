import { execFileSync } from 'node:child_process';
import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser, makeAdmin, TestCookieJar } from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { handle } from '../../hooks.server';
import { load as layoutLoad } from './+layout.server';
import { load as indexLoad } from './+page.server';
import { load as usersLoad } from './users/+page.server';
import { load as userLoad } from './users/[id]/+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let adminJar: TestCookieJar;
let annaJar: TestCookieJar;
let admin: SessionUser;
let anna: SessionUser;

function event(user: SessionUser | null, path: string, params: Record<string, string> = {}) {
	const url = new URL(`http://localhost:5173${path}`);
	return {
		url,
		params,
		locals: { user },
		request: new Request(url),
		getClientAddress: () => '203.0.113.5'
	} as never;
}

async function outcome(run: () => unknown) {
	try {
		return { result: await run() };
	} catch (thrown) {
		return { thrown: thrown as { status: number; location?: string } };
	}
}

async function visit(path: string, jar: TestCookieJar) {
	const url = new URL(`http://localhost:5173${path}`);
	const hookEvent = {
		url,
		request: new Request(url, { headers: jar.headers() }),
		cookies: jar,
		locals: {} as App.Locals,
		route: { id: url.pathname },
		getClientAddress: () => '203.0.113.5'
	} as unknown as RequestEvent;
	return outcome(() => handle({ event: hookEvent, resolve: async () => new Response('ok') }));
}

beforeEach(async () => {
	await resetDatabase();
	adminJar = await createSignedInUser('root@example.com', 'Rita Admin');
	await makeAdmin('root@example.com');
	admin = (await getSessionUser(adminJar.headers()))!;
	annaJar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(annaJar.headers()))!;
});

const adminPaths = ['/admin', '/admin/users', '/admin/users/some-id', '/admin/audit'];

describe('every /admin page', () => {
	it('is refused to a signed-in person who is not an admin, before any page code runs', async () => {
		for (const path of adminPaths) {
			expect((await visit(path, annaJar)).thrown, path).toMatchObject({ status: 403 });
		}
	});

	it('sends a signed-out visitor to log in', async () => {
		for (const path of adminPaths) {
			expect((await visit(path, new TestCookieJar())).thrown, path).toMatchObject({ status: 303 });
		}
	});

	it('is open to an admin', async () => {
		for (const path of adminPaths) {
			expect((await visit(path, adminJar)).result, path).toBeInstanceOf(Response);
		}
	});

	it('is also refused by each page’s own check', async () => {
		const pages = [
			() => layoutLoad(event(anna, '/admin')),
			() => indexLoad(event(anna, '/admin')),
			() => usersLoad(event(anna, '/admin/users')),
			() => userLoad(event(anna, `/admin/users/${admin.id}`, { id: admin.id }))
		];
		for (const page of pages) {
			expect((await outcome(page)).thrown).toMatchObject({ status: 403 });
		}
		expect((await outcome(() => usersLoad(event(null, '/admin/users')))).thrown).toMatchObject({
			status: 401
		});
	});
});

describe('the admin user pages', () => {
	it('finds a user by email', async () => {
		const data = (await usersLoad(event(admin, '/admin/users?q=anna@example.com'))) as {
			query: string;
			total: number;
			users: { id: string; email: string; createdAt: string }[];
		};

		expect(data.query).toBe('anna@example.com');
		expect(data.total).toBe(1);
		expect(data.users[0]).toMatchObject({ id: anna.id, email: 'anna@example.com' });
		expect(data.users[0].createdAt).toMatch(/^\d{4}-/);
	});

	it('opens a user’s details', async () => {
		const data = (await userLoad(event(admin, `/admin/users/${anna.id}`, { id: anna.id }))) as {
			user: { email: string; recentActivity: { action: string }[] };
		};

		expect(data.user.email).toBe('anna@example.com');
		expect(data.user.recentActivity.map((entry) => entry.action)).toContain('signup');
	});

	it('answers "not found" for a user that doesn’t exist', async () => {
		expect(
			(await outcome(() => userLoad(event(admin, '/admin/users/nope', { id: 'nope' })))).thrown
		).toMatchObject({ status: 404 });
	});

	it('leads from /admin to the user list', async () => {
		expect((await outcome(() => indexLoad(event(admin, '/admin')))).thrown).toMatchObject({
			status: 303,
			location: '/admin/users'
		});
	});
});

describe('the command that makes the first admin', () => {
	const run = (email: string) =>
		execFileSync('node', ['scripts/grant-admin.js', email], {
			env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		});

	it('gives an existing account the admin role', async () => {
		expect(anna.role).toBe('user');

		expect(run('Anna@Example.com')).toMatch(/is now an admin/);

		expect((await getSessionUser(annaJar.headers()))?.role).toBe('admin');
	});

	it('fails clearly for an email that has no account', () => {
		expect(() => run('nobody@example.com')).toThrow(/No account has the email/);
	});
});
