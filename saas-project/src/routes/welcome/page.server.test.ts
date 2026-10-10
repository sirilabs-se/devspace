import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser, TestCookieJar } from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { handle } from '../../hooks.server';
import { actions, load } from './+page.server';
import { sql } from 'drizzle-orm';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let jar: TestCookieJar;
let pending: SessionUser;

/** Someone in the state a new Google or Facebook sign-up is in: signed in, terms not yet accepted. */
async function signedInWithoutConsents() {
	jar = await createSignedInUser('maya@example.com', 'Maya Okafor');
	await db.execute(sql`delete from consents`);
	pending = (await getSessionUser(jar.headers()))!;
}

async function visit(path: string) {
	const url = new URL(`http://localhost:5173${path}`);
	const event = {
		url,
		request: new Request(url, { headers: jar.headers() }),
		cookies: jar,
		locals: {} as App.Locals,
		route: { id: url.pathname }
	} as unknown as RequestEvent;
	try {
		await handle({ event, resolve: async () => new Response('ok') });
		return { reached: true as const };
	} catch (thrown) {
		return { reached: false as const, redirect: thrown as { status: number; location: string } };
	}
}

function submit(user: SessionUser | null, fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	return actions.default({
		request: new Request('http://localhost:5173/welcome', { method: 'POST', body }),
		locals: { user },
		getClientAddress: () => '203.0.113.5'
	} as never);
}

beforeEach(async () => {
	await resetDatabase();
	await signedInWithoutConsents();
});

describe('until the welcome step is completed', () => {
	it('every other page leads to /welcome', async () => {
		expect(pending.welcomePending).toBe(true);

		for (const path of [
			'/',
			'/settings/profile',
			'/settings/account',
			'/settings/security',
			'/login'
		]) {
			const result = await visit(path);
			expect(result.reached, path).toBe(false);
			expect(result.redirect).toMatchObject({ status: 303, location: '/welcome' });
		}
	});

	it('the welcome page itself and logging out stay reachable', async () => {
		expect((await visit('/welcome')).reached).toBe(true);
		expect((await visit('/logout')).reached).toBe(true);
		// So an admin viewing the app as this person can return to their own account.
		expect((await visit('/stop-impersonating')).reached).toBe(true);
		expect(await load({ locals: { user: pending } } as never)).toEqual({
			name: 'Maya Okafor',
			email: 'maya@example.com'
		});
	});
});

describe('the welcome form', () => {
	it('asks again when the checkbox is not ticked or the username can’t be used', async () => {
		expect(await submit(pending, { username: '' })).toMatchObject({
			status: 400,
			data: { errors: { acceptTerms: 'terms_required' } }
		});
		expect(await submit(pending, { acceptTerms: 'on', username: 'admin' })).toMatchObject({
			status: 400,
			data: { errors: { username: 'username_reserved' }, username: 'admin' }
		});
	});

	it('completes the step, after which the rest of the app opens up', async () => {
		await expect(async () =>
			submit(pending, { acceptTerms: 'on', username: 'maya' })
		).rejects.toMatchObject({ status: 303, location: '/' });

		expect((await visit('/settings/profile')).reached).toBe(true);
		const user = (await getSessionUser(jar.headers()))!;
		expect(user).toMatchObject({ welcomePending: false, username: 'maya' });
		// Someone who has finished is sent on if they come back.
		expect(() => load({ locals: { user } } as never)).toThrow(
			expect.objectContaining({ status: 303, location: '/' })
		);
	});

	it('refuses someone who is not signed in', async () => {
		await expect(async () => submit(null, { acceptTerms: 'on' })).rejects.toMatchObject({
			status: 401
		});
	});
});
