import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const valid = {
	name: 'Anna Berg',
	email: 'anna@example.com',
	password: 'Correct-Horse-42',
	username: 'anna',
	acceptTerms: 'on'
};

async function submit(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);

	const cookies = new Map<string, string>();
	const event = {
		request: new Request('http://localhost:5173/signup', {
			method: 'POST',
			body,
			headers: { 'user-agent': 'Test Browser' }
		}),
		cookies: { set: (name: string, value: string) => void cookies.set(name, value) },
		getClientAddress: () => '203.0.113.5'
	};
	try {
		const result = await actions.register(
			event as unknown as Parameters<typeof actions.register>[0]
		);
		return { result, cookies };
	} catch (thrown) {
		return { redirect: thrown as { status: number; location: string }, cookies };
	}
}

/** What a successful sign-up looks like from outside: on to the "check your inbox" page. */
const toInbox = { status: 303, location: '/verify-email' };

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
});

describe('the sign-up form action', () => {
	it('sends the verification email and moves on to "check your inbox"', async () => {
		const outcome = await submit(valid);

		expect(outcome.redirect).toMatchObject(toInbox);
		expect(outcome.cookies.get('pending_email')).toBe('anna@example.com');
		expect(sendEmail).toHaveBeenCalledOnce();
	});

	it('gives exactly the same answer when the email is already registered', async () => {
		const first = await submit(valid);
		const second = await submit({ ...valid, username: 'another-name' });

		expect(second.redirect).toMatchObject(toInbox);
		expect(second).toEqual(first);
	});

	it('returns field errors and the typed values, but never the password', async () => {
		const { result } = await submit({ ...valid, password: 'zx-81-pw', username: 'admin' });

		expect(result).toMatchObject({
			status: 400,
			data: {
				errors: { password: 'password_too_weak', username: 'username_reserved' },
				values: { name: 'Anna Berg', email: 'anna@example.com', username: 'admin' }
			}
		});
		expect(JSON.stringify(result)).not.toContain('zx-81-pw');
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('treats an unticked box as not accepted', async () => {
		const { result } = await submit({
			name: valid.name,
			email: valid.email,
			password: valid.password
		});

		expect(result).toMatchObject({
			status: 400,
			data: { errors: { acceptTerms: 'terms_required' } }
		});
	});

	it('answers "too many attempts" after ten sign-ups in an hour from one address', async () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			await submit({ ...valid, email: `person${attempt}@example.com`, username: '' });
		}

		const { result } = await submit({ ...valid, email: 'one-more@example.com', username: '' });

		expect(result).toMatchObject({
			status: 429,
			data: { rateLimited: true, values: { email: 'one-more@example.com' } }
		});
		expect(JSON.stringify(result)).not.toContain(valid.password);
	});

	it('accepts a sign-up with no username', async () => {
		const outcome = await submit({
			name: valid.name,
			email: valid.email,
			password: valid.password,
			acceptTerms: 'on'
		});

		expect(outcome.redirect).toMatchObject(toInbox);
	});
});
