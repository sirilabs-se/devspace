import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedInUser, TestCookieJar } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { getSessionUser, requireUser } from './session';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

beforeEach(async () => {
	await resetDatabase();
});

describe('getSessionUser', () => {
	it('returns nobody for a request without a session', async () => {
		expect(await getSessionUser(new Headers())).toBeNull();
	});

	it('returns nobody for a made-up session cookie', async () => {
		const headers = new Headers({ cookie: 'better-auth.session_token=made-up.value' });

		expect(await getSessionUser(headers)).toBeNull();
	});

	it('returns the person the session belongs to', async () => {
		const jar = await createSignedInUser('anna@example.com', 'Anna Berg');

		expect(await getSessionUser(jar.headers())).toMatchObject({
			name: 'Anna Berg',
			email: 'anna@example.com',
			username: null,
			emailVerified: true
		});
	});

	it('never returns another person’s account details', async () => {
		const anna = await createSignedInUser('anna@example.com', 'Anna Berg');
		const bo = await createSignedInUser('bo@example.com', 'Bo Lind');
		const boUser = await getSessionUser(bo.headers());

		// Anna's session, with every other part of the request pointing at Bo.
		const headers = anna.headers();
		headers.set('x-user-id', boUser!.id);
		headers.set('x-forwarded-user', 'bo@example.com');
		headers.set('authorization', `Bearer ${boUser!.id}`);

		const seen = await getSessionUser(headers, new TestCookieJar());

		expect(seen?.email).toBe('anna@example.com');
		expect(seen?.id).not.toBe(boUser!.id);
	});
});

describe('requireUser', () => {
	it('returns the signed-in user', async () => {
		const jar = await createSignedInUser('anna@example.com');
		const user = await getSessionUser(jar.headers());

		expect(requireUser({ user })).toBe(user);
	});

	it('stops the request when nobody is signed in', () => {
		expect(() => requireUser({ user: null })).toThrow(expect.objectContaining({ status: 401 }));
	});
});
