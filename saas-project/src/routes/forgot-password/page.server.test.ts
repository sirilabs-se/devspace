import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { createSignedInUser, resetTokenFor } from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions } from './+page.server';
import { actions as resetActions, load as resetLoad } from '../reset-password/+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';

function form(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	return body;
}

function forgot(address: string, ipAddress = '203.0.113.5') {
	const event = {
		request: new Request('http://localhost:5173/forgot-password', {
			method: 'POST',
			body: form({ email: address })
		}),
		getClientAddress: () => ipAddress
	};
	return actions.default(event as never);
}

function reset(token: string, password: string, confirmPassword = password) {
	const url = new URL(`http://localhost:5173/reset-password?token=${encodeURIComponent(token)}`);
	const event = {
		url,
		request: new Request(url, { method: 'POST', body: form({ password, confirmPassword }) }),
		getClientAddress: () => '203.0.113.5'
	};
	return resetActions.default(event as never);
}

const linkState = (token: string) =>
	resetLoad({
		url: new URL(`http://localhost:5173/reset-password?token=${encodeURIComponent(token)}`)
	} as never);

beforeEach(async () => {
	await resetDatabase();
	await createSignedInUser(email, 'Anna Berg');
	vi.mocked(sendEmail).mockClear();
});

describe('the forgot-password action', () => {
	it('gives exactly the same answer for a registered and an unregistered address', async () => {
		const known = await forgot(email);
		const unknown = await forgot('nobody@example.com');

		expect(known).toEqual({ sent: true, email });
		expect(unknown).toEqual({ sent: true, email: 'nobody@example.com' });
		expect(sendEmail).toHaveBeenCalledOnce();
		expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe(email);
	});

	it('asks again for something that is not an email address', async () => {
		expect(await forgot('not-an-email')).toMatchObject({ status: 400, data: { emailError: true } });
	});

	it('answers "too many attempts" on the fourth request in an hour for one email', async () => {
		for (let attempt = 0; attempt < 3; attempt++) await forgot(email, `198.51.100.${attempt}`);

		expect(await forgot(email, '198.51.100.9')).toMatchObject({
			status: 429,
			data: { rateLimited: true }
		});
	});
});

describe('the reset-password page', () => {
	it('shows the form for a working link and says so for a made-up one', async () => {
		await forgot(email);

		expect(await linkState(resetTokenFor(email))).toEqual({ link: 'valid' });
		expect(await linkState('made-up')).toEqual({ link: 'invalid' });
	});

	it('updates the password, and then treats the link as used', async () => {
		await forgot(email);
		const token = resetTokenFor(email);

		expect(await reset(token, 'Brand-New-Horse-7')).toEqual({ done: true });
		expect(await linkState(token)).toEqual({ link: 'invalid' });
		expect(await reset(token, 'Another-Horse-9!')).toMatchObject({
			status: 400,
			data: { link: 'invalid' }
		});
	});

	it('explains a weak password or a mismatch without sending either password back', async () => {
		await forgot(email);
		const token = resetTokenFor(email);

		const weak = await reset(token, 'sunset');
		const differ = await reset(token, 'Brand-New-Horse-7', 'Other-Horse-9!');

		expect(weak).toMatchObject({ status: 400, data: { error: 'password_too_weak' } });
		expect(differ).toMatchObject({ status: 400, data: { error: 'passwords_differ' } });
		expect(JSON.stringify([weak, differ])).not.toMatch(/sunset|Brand-New|Other-Horse/);
	});
});
