import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { getSessionUser } from '$lib/server/modules/identity';
import {
	createUnverifiedUser,
	expiredVerificationTokenFor,
	verificationTokenFor
} from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions, load } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';

/** A stand-in for SvelteKit's cookies that also plays them back as a request header. */
function cookieJar(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const cookies = {
		get: (name: string) => values.get(name),
		set: (name: string, value: string) => void values.set(name, value),
		delete: (name: string) => void values.delete(name)
	} as unknown as Cookies;
	const headers = () =>
		new Headers({
			cookie: [...values].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ')
		});
	return { cookies, values, headers };
}

async function open(query: string, jar = cookieJar(), user: App.Locals['user'] = null) {
	const url = new URL(`http://localhost:5173/verify-email${query}`);
	const event = {
		url,
		cookies: jar.cookies,
		locals: { user },
		request: new Request(url),
		getClientAddress: () => '203.0.113.5'
	};
	try {
		return { data: await load(event as unknown as Parameters<typeof load>[0]) };
	} catch (thrown) {
		return { redirect: thrown as { status: number; location: string } };
	}
}

function resend(fields: Record<string, string>, jar = cookieJar()) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const event = {
		request: new Request('http://localhost:5173/verify-email?/resend', { method: 'POST', body }),
		cookies: jar.cookies,
		getClientAddress: () => '203.0.113.5'
	};
	return actions.resend(event as unknown as Parameters<typeof actions.resend>[0]);
}

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
	await createUnverifiedUser(email, 'Anna Berg');
});

describe('the verify-email page', () => {
	it('shows "check your inbox" with the address remembered from sign-up', async () => {
		const result = await open('', cookieJar({ pending_email: email }));

		expect(result.data).toEqual({ state: 'required', email });
	});

	it('shows "check your inbox" without an address when none is remembered', async () => {
		expect((await open('')).data).toEqual({ state: 'required', email: null });
	});

	it('verifies a valid link, signs the person in and moves on to the "verified" screen', async () => {
		const jar = cookieJar({ pending_email: email });

		const result = await open(`?token=${encodeURIComponent(verificationTokenFor(email))}`, jar);

		expect(result.redirect).toMatchObject({ status: 303, location: '/verify-email?done' });
		expect(jar.values.has('pending_email')).toBe(false);

		const user = await getSessionUser(jar.headers());
		expect(user).toMatchObject({ email, emailVerified: true });
		expect((await open('?done', jar, user)).data).toEqual({ state: 'verified', email });
	});

	it('does not show "verified" to someone who is not signed in', async () => {
		expect((await open('?done')).data).toMatchObject({ state: 'required' });
	});

	it('shows "expired" for a link past 24 hours and "invalid" for a bad or used one', async () => {
		const expired = expiredVerificationTokenFor(email);
		expect((await open(`?token=${expired}`)).data).toMatchObject({ state: 'expired' });

		expect((await open('?token=nonsense')).data).toMatchObject({ state: 'invalid' });

		const token = verificationTokenFor(email);
		await open(`?token=${token}`);
		expect((await open(`?token=${token}`)).data).toMatchObject({ state: 'invalid' });
	});
});

describe('the resend action', () => {
	it('resends to the address remembered from sign-up', async () => {
		vi.mocked(sendEmail).mockClear();

		expect(await resend({}, cookieJar({ pending_email: email }))).toEqual({ resent: true });
		expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe(email);
	});

	it('resends to the address typed on the expired-link screen', async () => {
		vi.mocked(sendEmail).mockClear();

		expect(await resend({ email })).toEqual({ resent: true });
		expect(sendEmail).toHaveBeenCalledOnce();
	});

	it('answers "please wait" on the fourth resend within an hour', async () => {
		for (let attempt = 0; attempt < 3; attempt++) await resend({ email });

		const result = await resend({ email });

		expect(result).toMatchObject({ status: 429, data: { throttled: true } });
	});

	it('refuses when there is no usable address', async () => {
		expect(await resend({})).toMatchObject({ status: 400, data: { emailError: 'email_invalid' } });
	});
});
