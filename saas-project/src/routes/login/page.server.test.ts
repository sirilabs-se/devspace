import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { getSessionUser } from '$lib/server/modules/identity';
import {
	createSignedInUser,
	createUnverifiedUser,
	TestCookieJar
} from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions, load } from './+page.server';
import { actions as logoutActions } from '../logout/+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const password = 'Correct-Horse-42';

type Outcome = { result?: unknown; redirect?: { status: number; location: string } };

async function post(
	action: keyof typeof actions,
	fields: Record<string, string>,
	jar = new TestCookieJar(),
	query = ''
): Promise<Outcome> {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const url = new URL(`http://localhost:5173/login${query}`);
	const event = {
		url,
		request: new Request(url, { method: 'POST', body, headers: jar.headers() }),
		cookies: jar,
		getClientAddress: () => '203.0.113.5'
	};
	try {
		return { result: await actions[action](event as never) };
	} catch (thrown) {
		return { redirect: thrown as { status: number; location: string } };
	}
}

async function logOut(jar: TestCookieJar): Promise<Outcome> {
	const url = new URL('http://localhost:5173/logout');
	const event = {
		url,
		request: new Request(url, { method: 'POST', headers: jar.headers() }),
		cookies: jar,
		getClientAddress: () => '203.0.113.5'
	};
	try {
		return { result: await logoutActions.default(event as never) };
	} catch (thrown) {
		return { redirect: thrown as { status: number; location: string } };
	}
}

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
	const jar = await createSignedInUser(email, 'Anna Berg');
	await logOut(jar);
});

describe('step 1: email', () => {
	it('moves every well-formed email on to the password step, registered or not', async () => {
		const known = await post('email', { email: ' Anna@Example.com ' });
		const unknown = await post('email', { email: 'nobody@example.com' });

		expect(known.result).toEqual({ step: 'password', email });
		expect(unknown.result).toEqual({ step: 'password', email: 'nobody@example.com' });
	});

	it('asks again for something that is not an email address', async () => {
		const { result } = await post('email', { email: 'not-an-email' });

		expect(result).toMatchObject({ status: 400, data: { step: 'email', emailError: true } });
	});
});

describe('step 2: password', () => {
	it('signs a verified person in and sends them to the home page', async () => {
		const jar = new TestCookieJar();

		const outcome = await post('password', { email, password }, jar);

		expect(outcome.redirect).toMatchObject({ status: 303, location: '/' });
		expect(await getSessionUser(jar.headers())).toMatchObject({ email });
	});

	it('sends them back to the page they were heading for, but never to another site', async () => {
		const inside = await post(
			'password',
			{ email, password },
			new TestCookieJar(),
			'?next=%2Fsettings%2Fprofile'
		);
		const outside = await post(
			'password',
			{ email, password },
			new TestCookieJar(),
			'?next=https%3A%2F%2Fevil.example'
		);

		expect(inside.redirect?.location).toBe('/settings/profile');
		expect(outside.redirect?.location).toBe('/');
	});

	it('gives exactly the same response for a wrong password and an unknown email', async () => {
		const wrongPassword = await post('password', { email, password: 'Wrong-Horse-42' });
		const unknownEmail = await post('password', { email: 'nobody@example.com', password });

		expect(wrongPassword.result).toMatchObject({
			status: 400,
			data: { step: 'password', invalid: true }
		});
		expect({ ...(unknownEmail.result as { data: object }).data, email }).toEqual(
			(wrongPassword.result as { data: object }).data
		);
		expect(JSON.stringify(wrongPassword.result)).not.toContain('Wrong-Horse-42');
	});

	it('shows "verify your email" when the password is right but the email is unverified', async () => {
		await createUnverifiedUser('bo@example.com', 'Bo Lind');

		const right = await post('password', { email: 'bo@example.com', password });
		const wrong = await post('password', { email: 'bo@example.com', password: 'Wrong-Horse-42' });

		expect(right.result).toEqual({ step: 'unverified', email: 'bo@example.com' });
		expect(wrong.result).toMatchObject({ status: 400, data: { invalid: true } });
	});
});

describe('resend from the "verify your email" screen', () => {
	it('sends the email again and moves on to "check your inbox"', async () => {
		await createUnverifiedUser('bo@example.com', 'Bo Lind');
		vi.mocked(sendEmail).mockClear();
		const jar = new TestCookieJar();

		const outcome = await post('resend', { email: 'bo@example.com' }, jar);

		expect(outcome.redirect).toMatchObject({ status: 303, location: '/verify-email' });
		expect(jar.get('pending_email')).toBe('bo@example.com');
		expect(sendEmail).toHaveBeenCalledOnce();
	});
});

describe('the login page for someone already signed in', () => {
	it('sends them to the home page', async () => {
		const jar = new TestCookieJar();
		await post('password', { email, password }, jar);
		const user = await getSessionUser(jar.headers());

		const visit = () =>
			load({ locals: { user }, url: new URL('http://localhost:5173/login') } as never);

		expect(visit).toThrow(expect.objectContaining({ status: 303, location: '/' }));
	});
});

describe('logging out', () => {
	it('ends the session and returns to the home page', async () => {
		const jar = new TestCookieJar();
		await post('password', { email, password }, jar);
		const signedIn = jar.headers();

		const outcome = await logOut(jar);

		expect(outcome.redirect).toMatchObject({ status: 303, location: '/' });
		expect(await getSessionUser(signedIn)).toBeNull();
		expect(await getSessionUser(jar.headers())).toBeNull();
	});
});
