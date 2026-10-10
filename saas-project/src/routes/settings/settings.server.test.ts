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

describe('deleting the account', () => {
	it('schedules the deletion, signs the person out and sends them to the login page', async () => {
		const before = jar.headers();

		const { thrown } = await outcome(() =>
			accountActions.deleteAccount(
				event('/settings/account', { deletePassword: 'Correct-Horse-42', confirmDelete: 'on' })
			)
		);

		expect(thrown).toMatchObject({ status: 303, location: '/login?notice=deletion-scheduled' });
		expect(await getSessionUser(before)).toBeNull();
	});

	it('explains a wrong password or a missing confirmation, and changes nothing', async () => {
		const wrong = await outcome(() =>
			accountActions.deleteAccount(
				event('/settings/account', { deletePassword: 'Wrong-Horse-42', confirmDelete: 'on' })
			)
		);
		const unticked = await outcome(() =>
			accountActions.deleteAccount(
				event('/settings/account', { deletePassword: 'Correct-Horse-42' })
			)
		);

		expect(wrong.result).toMatchObject({
			status: 400,
			data: { deleteError: 'current_password_wrong' }
		});
		expect(unticked.result).toMatchObject({ status: 400, data: { deleteError: 'not_confirmed' } });
		expect(await getSessionUser(jar.headers())).not.toBeNull();
	});
});

describe('passkeys on the security page', () => {
	it('lists none at first, and refuses to rename or remove one that isn’t there', async () => {
		const data = (await securityLoad(event('/settings/security'))) as { passkeys: unknown[] };
		expect(data.passkeys).toEqual([]);

		expect(
			(
				await outcome(() =>
					securityActions.removePasskey(event('/settings/security', { passkeyId: 'x' }))
				)
			).result
		).toMatchObject({ status: 400, data: { passkeyError: 'not_found' } });
		expect(
			(
				await outcome(() =>
					securityActions.renamePasskey(
						event('/settings/security', { passkeyId: 'x', name: 'New' })
					)
				)
			).result
		).toMatchObject({ status: 400, data: { passkeyError: 'not_found' } });
	});

	it('refuses someone who is not signed in', async () => {
		user = null;

		for (const action of [securityActions.removePasskey, securityActions.renamePasskey]) {
			expect((await outcome(() => action(event('/settings/security')))).thrown?.status).toBe(401);
		}
	});
});

describe('two-step verification on the security page', () => {
	it('sets up, turns on, makes new backup codes and turns off, each needing the password or a code', async () => {
		const start = await outcome(() =>
			securityActions.startTwoStep(event('/settings/security', { password: 'Correct-Horse-42' }))
		);
		const setup = (start.result as { twoStepSetup: { setupKey: string; backupCodes: string[] } })
			.twoStepSetup;
		expect(setup.backupCodes.length).toBeGreaterThan(0);

		const wrongCode = await outcome(() =>
			securityActions.confirmTwoStep(event('/settings/security', { code: '000000' }))
		);
		expect(wrongCode.result).toMatchObject({ status: 400, data: { twoStepError: 'code_wrong' } });

		const { authenticatorCode } = await import('../../../tests/setup/totp');
		const confirm = await outcome(() =>
			securityActions.confirmTwoStep(
				event('/settings/security', { code: authenticatorCode(setup.setupKey) })
			)
		);
		expect(confirm.result).toEqual({ twoStepTurnedOn: true });
		expect(
			((await securityLoad(event('/settings/security'))) as { twoStepOn: boolean }).twoStepOn
		).toBe(true);

		const codes = await outcome(() =>
			securityActions.newBackupCodes(event('/settings/security', { password: 'Correct-Horse-42' }))
		);
		expect((codes.result as { newBackupCodes: string[] }).newBackupCodes).not.toEqual(
			setup.backupCodes
		);

		const wrongPassword = await outcome(() =>
			securityActions.turnOffTwoStep(event('/settings/security', { password: 'Wrong-Horse-42' }))
		);
		expect(wrongPassword.result).toMatchObject({
			status: 400,
			data: { twoStepError: 'current_password_wrong' }
		});

		const off = await outcome(() =>
			securityActions.turnOffTwoStep(event('/settings/security', { password: 'Correct-Horse-42' }))
		);
		expect(off.result).toEqual({ twoStepTurnedOff: true });
	});

	it('refuses someone who is not signed in', async () => {
		user = null;

		for (const action of [
			securityActions.startTwoStep,
			securityActions.confirmTwoStep,
			securityActions.newBackupCodes,
			securityActions.turnOffTwoStep
		]) {
			expect((await outcome(() => action(event('/settings/security')))).thrown?.status).toBe(401);
		}
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
