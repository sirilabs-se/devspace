import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser, TestCookieJar } from '../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { actions, load } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let jar: TestCookieJar;
let user: SessionUser | null;

function event(fields: Record<string, string> = {}, query = '') {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const url = new URL(`http://localhost:5173/settings/connections${query}`);
	return {
		url,
		request: new Request(url, { method: 'POST', body, headers: jar.headers() }),
		cookies: jar,
		locals: { user },
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

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser('anna@example.com', 'Anna Berg');
	user = await getSessionUser(jar.headers());
});

describe('the connected accounts page', () => {
	it('lists the password and the providers, with the message from a return', async () => {
		const data = await load(event({}, '?connected=google'));

		expect(data).toEqual({
			hasPassword: true,
			providers: [
				{ provider: 'google', connected: false, connectedAt: null },
				{ provider: 'facebook', connected: false, connectedAt: null }
			],
			justConnected: 'google',
			connectError: null
		});
	});

	it('sends the person to the provider to connect it', async () => {
		const { thrown } = await outcome(() => actions.connect(event({ provider: 'google' })));

		expect(thrown?.status).toBe(303);
		expect(thrown?.location).toMatch(/^https:\/\/accounts\.google\.com\//);
	});

	it('refuses an unknown provider, and disconnecting one that is not connected', async () => {
		expect(
			(await outcome(() => actions.connect(event({ provider: 'github' })))).result
		).toMatchObject({
			status: 400,
			data: { error: 'unavailable' }
		});
		expect(
			(await outcome(() => actions.disconnect(event({ provider: 'google' })))).result
		).toMatchObject({ status: 400, data: { error: 'not_connected' } });
	});

	it('refuses someone who is not signed in', async () => {
		user = null;

		expect((await outcome(() => load(event()))).thrown?.status).toBe(401);
		expect(
			(await outcome(() => actions.connect(event({ provider: 'google' })))).thrown?.status
		).toBe(401);
		expect(
			(await outcome(() => actions.disconnect(event({ provider: 'google' })))).thrown?.status
		).toBe(401);
	});
});
