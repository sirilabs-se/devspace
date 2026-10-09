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

function submit(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);

	const event = {
		request: new Request('http://localhost:5173/signup', {
			method: 'POST',
			body,
			headers: { 'user-agent': 'Test Browser' }
		}),
		getClientAddress: () => '203.0.113.5'
	};
	return actions.default(event as unknown as Parameters<typeof actions.default>[0]);
}

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
});

describe('the sign-up form action', () => {
	it('answers "sent" with the typed email and sends the verification email', async () => {
		expect(await submit(valid)).toEqual({ sent: true, email: 'anna@example.com' });
		expect(sendEmail).toHaveBeenCalledOnce();
	});

	it('gives exactly the same answer when the email is already registered', async () => {
		const first = await submit(valid);
		const second = await submit({ ...valid, username: 'another-name' });

		expect(second).toEqual(first);
	});

	it('returns field errors and the typed values, but never the password', async () => {
		const result = await submit({ ...valid, password: 'zx-81-pw', username: 'admin' });

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
		const result = await submit({
			name: valid.name,
			email: valid.email,
			password: valid.password
		});

		expect(result).toMatchObject({
			status: 400,
			data: { errors: { acceptTerms: 'terms_required' } }
		});
	});

	it('accepts a sign-up with no username', async () => {
		const result = await submit({
			name: valid.name,
			email: valid.email,
			password: valid.password,
			acceptTerms: 'on'
		});

		expect(result).toEqual({ sent: true, email: 'anna@example.com' });
	});
});
