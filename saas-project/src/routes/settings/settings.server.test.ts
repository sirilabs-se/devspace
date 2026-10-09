import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser, TestCookieJar } from '../../../tests/setup/accounts';
import { resetDatabase } from '../../../tests/setup/reset-database';
import { actions as accountActions, load as accountLoad } from './account/+page.server';
import { actions as securityActions, load as securityLoad } from './security/+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';

let jar: TestCookieJar;
let user: SessionUser | null;

function event(path: string, fields: Record<string, string> = {}) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const url = new URL(`http://localhost:5173${path}`);
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
	jar = await createSignedInUser(email, 'Anna Berg');
	user = await getSessionUser(jar.headers());
});

describe('account settings', () => {
	it('shows the signed-in person’s email', async () => {
		expect(await accountLoad(event('/settings/account'))).toEqual({ email, hasPassword: true });
	});

	it('changes the password', async () => {
		const { result } = await outcome(() =>
			accountActions.changePassword(
				event('/settings/account', {
					currentPassword: 'Correct-Horse-42',
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				})
			)
		);

		expect(result).toEqual({ passwordChanged: true });
	});

	it('explains a wrong current password without sending any password back', async () => {
		const { result } = await outcome(() =>
			accountActions.changePassword(
				event('/settings/account', {
					currentPassword: 'Wrong-Horse-42',
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				})
			)
		);

		expect(result).toMatchObject({
			status: 400,
			data: { passwordError: 'current_password_wrong' }
		});
		expect(JSON.stringify(result)).not.toMatch(/Horse/);
	});

	it('does not let someone with a password set a new one without the current one', async () => {
		const { result } = await outcome(() =>
			accountActions.setPassword(
				event('/settings/account', {
					password: 'Brand-New-Horse-7',
					confirmPassword: 'Brand-New-Horse-7'
				})
			)
		);

		expect(result).toMatchObject({ status: 400, data: { passwordError: 'already_has_password' } });
	});

	it('refuses someone who is not signed in', async () => {
		user = null;

		expect((await outcome(() => accountLoad(event('/settings/account')))).thrown?.status).toBe(401);
		expect(
			(await outcome(() => accountActions.changePassword(event('/settings/account')))).thrown
				?.status
		).toBe(401);
	});
});

describe('security settings', () => {
	it('lists the signed-in person’s own security activity, and nobody else’s', async () => {
		await createSignedInUser('bo@example.com', 'Bo Lind');

		const data = (await securityLoad(event('/settings/security'))) as {
			timeZone: string;
			activity: { action: string; at: string; device: string }[];
		};

		expect(data.timeZone).toBe('UTC');
		expect(data.activity.map((entry) => entry.action)).toEqual(['email_verified', 'signup']);
		expect(data.activity[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(data.activity[0].device).toBe('Unknown device');
	});

	it('signs out everywhere and sends the person to log in', async () => {
		const before = jar.headers();

		const { thrown } = await outcome(() =>
			securityActions.signOutEverywhere(event('/settings/security'))
		);

		expect(thrown).toMatchObject({ status: 303, location: '/login' });
		expect(await getSessionUser(before)).toBeNull();
	});

	it('refuses someone who is not signed in', async () => {
		user = null;

		expect((await outcome(() => securityLoad(event('/settings/security')))).thrown?.status).toBe(
			401
		);
		expect(
			(await outcome(() => securityActions.signOutEverywhere(event('/settings/security')))).thrown
				?.status
		).toBe(401);
	});
});
