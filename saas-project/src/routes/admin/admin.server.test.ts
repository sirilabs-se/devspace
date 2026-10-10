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
import { actions as userActions, load as userLoad } from './users/[id]/+page.server';

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

describe('suspending from the user page', () => {
	function post(user: SessionUser | null, fields: Record<string, string> = {}) {
		const body = new FormData();
		for (const [name, value] of Object.entries(fields)) body.set(name, value);
		const url = new URL(`http://localhost:5173/admin/users/${anna.id}`);
		return {
			url,
			params: { id: anna.id },
			locals: { user },
			request: new Request(url, { method: 'POST', body }),
			getClientAddress: () => '203.0.113.5'
		} as never;
	}

	it('suspends with a reason, signs the person out, and reinstates', async () => {
		expect(await userActions.suspend(post(admin, { reason: 'Spamming event pages' }))).toEqual({
			suspended: true
		});
		expect(await getSessionUser(annaJar.headers())).toBeNull();

		const data = (await userLoad(event(admin, `/admin/users/${anna.id}`, { id: anna.id }))) as {
			user: { suspended: boolean; suspensionReason: string };
		};
		expect(data.user).toMatchObject({ suspended: true, suspensionReason: 'Spamming event pages' });

		expect(await userActions.reinstate(post(admin))).toEqual({ reinstated: true });
	});

	it('asks for a reason', async () => {
		expect(await userActions.suspend(post(admin, { reason: '' }))).toMatchObject({
			status: 400,
			data: { adminError: 'reason_required' }
		});
	});

	it('is refused to a non-admin and to a signed-out visitor', async () => {
		for (const action of [userActions.suspend, userActions.reinstate]) {
			expect((await outcome(() => action(post(anna, { reason: 'x' })))).thrown).toMatchObject({
				status: 403
			});
			expect((await outcome(() => action(post(null, { reason: 'x' })))).thrown).toMatchObject({
				status: 401
			});
		}
		expect(await getSessionUser(annaJar.headers())).not.toBeNull();
	});
});

describe('viewing the app as a user', () => {
	function post(jar: TestCookieJar, user: SessionUser | null, path: string, params = {}) {
		const url = new URL(`http://localhost:5173${path}`);
		return {
			url,
			params,
			locals: { user },
			cookies: jar,
			request: new Request(url, { method: 'POST', headers: jar.headers() }),
			getClientAddress: () => '203.0.113.5'
		} as never;
	}

	it('switches the admin’s browser to the user, shows the banner, and switches back', async () => {
		const started = await outcome(() =>
			userActions.impersonate(post(adminJar, admin, `/admin/users/${anna.id}`, { id: anna.id }))
		);
		expect(started.thrown).toMatchObject({ status: 303, location: '/' });

		const asAnna = (await getSessionUser(adminJar.headers()))!;
		expect(asAnna).toMatchObject({ id: anna.id, impersonatedBy: admin.id });
		const { load: rootLoad } = await import('../+layout.server');
		expect(await rootLoad({ locals: { user: asAnna } } as never)).toEqual({
			user: { name: 'Anna Berg', isAdmin: false, impersonated: true }
		});
		// The admin area is closed while viewing as the user.
		expect((await visit('/admin/users', adminJar)).thrown).toMatchObject({ status: 403 });

		const { actions: stopActions } = await import('../stop-impersonating/+page.server');
		const stopped = await outcome(() =>
			stopActions.default(post(adminJar, asAnna, '/stop-impersonating'))
		);
		expect(stopped.thrown).toMatchObject({ status: 303, location: `/admin/users/${anna.id}` });
		expect(await getSessionUser(adminJar.headers())).toMatchObject({ id: admin.id, role: 'admin' });
	});

	it('is refused to a non-admin', async () => {
		expect(
			(
				await outcome(() =>
					userActions.impersonate(post(annaJar, anna, `/admin/users/${admin.id}`, { id: admin.id }))
				)
			).thrown
		).toMatchObject({ status: 403 });
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
