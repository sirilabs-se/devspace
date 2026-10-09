import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { getSessionUser, verifyEmail } from '$lib/server/modules/identity';
import {
	createSignedInUser,
	TestCookieJar,
	testContext,
	undoTokenFor,
	verificationTokenFor
} from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions as accountActions } from '../settings/account/+page.server';
import { actions, load } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const oldEmail = 'anna@example.com';
const newEmail = 'anna.berg@example.org';

let jar: TestCookieJar;

async function requestChange(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const url = new URL('http://localhost:5173/settings/account?/changeEmail');
	return accountActions.changeEmail({
		url,
		request: new Request(url, { method: 'POST', body, headers: jar.headers() }),
		cookies: jar,
		locals: { user: await getSessionUser(jar.headers()) },
		getClientAddress: () => '203.0.113.5'
	} as never);
}

function undoEvent(token: string) {
	const url = new URL(`http://localhost:5173/undo-email-change?token=${token}`);
	return {
		url,
		request: new Request(url, { method: 'POST' }),
		getClientAddress: () => '203.0.113.5'
	} as never;
}

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser(oldEmail, 'Anna Berg');
	vi.mocked(sendEmail).mockClear();
});

describe('changing email from account settings', () => {
	it('gives the same answer for a free address and one another account has', async () => {
		await createSignedInUser('bo@example.com', 'Bo Lind');

		const free = await requestChange({ newEmail, emailPassword: 'Correct-Horse-42' });
		const taken = await requestChange({
			newEmail: 'bo@example.com',
			emailPassword: 'Correct-Horse-42'
		});

		expect(free).toEqual({ emailSent: true, newEmail });
		expect(taken).toEqual({ emailSent: true, newEmail: 'bo@example.com' });
	});

	it('explains a wrong password without sending it back', async () => {
		const result = await requestChange({ newEmail, emailPassword: 'Wrong-Horse-42' });

		expect(result).toMatchObject({ status: 400, data: { emailError: 'current_password_wrong' } });
		expect(JSON.stringify(result)).not.toContain('Wrong-Horse-42');
	});
});

describe('the undo page', () => {
	it('shows a confirmation for a working link, and undoes only when the button is pressed', async () => {
		await requestChange({ newEmail, emailPassword: 'Correct-Horse-42' });
		await verifyEmail(verificationTokenFor(newEmail), jar, testContext);
		const token = undoTokenFor(oldEmail);

		expect(await load(undoEvent(token))).toEqual({ usable: true });
		expect((await getSessionUser(jar.headers()))?.email).toBe(newEmail);

		expect(await actions.default(undoEvent(token))).toEqual({ undone: true });
		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await load(undoEvent(token))).toEqual({ usable: false });
	});

	it('says so for a link that can’t be used', async () => {
		expect(await load(undoEvent('made-up'))).toEqual({ usable: false });
		expect(await actions.default(undoEvent('made-up'))).toMatchObject({
			status: 400,
			data: { problem: 'invalid' }
		});
	});
});
