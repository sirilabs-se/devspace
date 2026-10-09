import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedInUser, TestCookieJar } from '../tests/setup/accounts';
import { resetDatabase } from '../tests/setup/reset-database';
import { handle } from './hooks.server';
import { isPublicPath } from '$lib/server/public-paths';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

/** Runs the hook for one request and reports where it ended up. */
async function visit(path: string, jar = new TestCookieJar(), routeExists = true) {
	const url = new URL(`http://localhost:5173${path}`);
	const event = {
		url,
		request: new Request(url, { headers: jar.headers() }),
		cookies: jar,
		locals: {} as App.Locals,
		route: { id: routeExists ? url.pathname : null }
	} as unknown as RequestEvent;

	try {
		await handle({ event, resolve: async () => new Response('ok') });
		return { reached: true as const, user: event.locals.user };
	} catch (thrown) {
		return { reached: false as const, redirect: thrown as { status: number; location: string } };
	}
}

beforeEach(async () => {
	await resetDatabase();
});

describe('the login check in hooks', () => {
	it('sends a signed-out visitor to /login from any page outside the public list', async () => {
		for (const path of ['/settings/profile', '/settings/security', '/admin/users', '/welcome']) {
			const result = await visit(path);

			expect(result.reached, path).toBe(false);
			expect(result.redirect).toMatchObject({
				status: 303,
				location: `/login?next=${encodeURIComponent(path)}`
			});
		}
	});

	it('lets a signed-out visitor reach every public page', async () => {
		for (const path of [
			'/',
			'/signup',
			'/verify-email',
			'/login',
			'/login/two-step',
			'/forgot-password',
			'/reset-password',
			'/api/auth/callback/google',
			'/api/username-available',
			'/api/jobs/daily'
		]) {
			const result = await visit(path);

			expect(result.reached, path).toBe(true);
			expect(result.user).toBeNull();
		}
	});

	it('lets a signed-in person through and says who they are', async () => {
		const jar = await createSignedInUser('anna@example.com', 'Anna Berg');

		const result = await visit('/settings/profile', jar);

		expect(result.reached).toBe(true);
		expect(result.user).toMatchObject({ name: 'Anna Berg', email: 'anna@example.com' });
	});

	it('takes the acting user only from the session, never from the address', async () => {
		const anna = await createSignedInUser('anna@example.com');
		const bo = await createSignedInUser('bo@example.com');
		const boUser = (await visit('/', bo)).user!;

		const result = await visit(`/settings/profile?userId=${boUser.id}&email=bo@example.com`, anna);

		expect(result.user?.email).toBe('anna@example.com');
	});

	it('leaves unknown addresses to the "not found" page', async () => {
		expect((await visit('/no-such-page', new TestCookieJar(), false)).reached).toBe(true);
	});
});

describe('isPublicPath', () => {
	it('does not treat look-alike paths as public', () => {
		expect(isPublicPath('/signup/')).toBe(true);
		expect(isPublicPath('/signup-admin')).toBe(false);
		expect(isPublicPath('/login/other')).toBe(false);
		expect(isPublicPath('/api/authx')).toBe(false);
		expect(isPublicPath('/settings')).toBe(false);
	});
});
