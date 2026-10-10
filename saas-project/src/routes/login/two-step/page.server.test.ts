import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	confirmTwoStepSetup,
	getSessionUser,
	logIn,
	startTwoStepSetup
} from '$lib/server/modules/identity';
import { createSignedInUser, TestCookieJar, testContext } from '../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { authenticatorCode } from '../../../../tests/setup/totp';
import { actions as loginActions } from '../+page.server';
import { actions, load } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const email = 'anna@example.com';
const password = 'Correct-Horse-42';

let setupKey: string;
let backupCodes: string[];

function event(jar: TestCookieJar, fields: Record<string, string> = {}, path = '/login/two-step') {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const url = new URL(`http://localhost:5173${path}`);
	return {
		url,
		request: new Request(url, { method: 'POST', body, headers: jar.headers() }),
		cookies: jar,
		locals: { user: null },
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

/** A fresh browser that has just entered the right password. */
async function afterPassword(query = '') {
	const jar = new TestCookieJar();
	const step = await outcome(() =>
		loginActions.password(event(jar, { email, password }, `/login${query}`))
	);
	return { jar, step };
}

beforeEach(async () => {
	await resetDatabase();
	const jar = await createSignedInUser(email, 'Anna Berg');
	const user = (await getSessionUser(jar.headers()))!;
	const started = await startTwoStepSetup(user, jar.headers(), password, testContext);
	if (started.status !== 'started') throw new Error('Set-up did not start');
	({ setupKey, backupCodes } = started);
	await confirmTwoStepSetup(user, jar.headers(), jar, authenticatorCode(setupKey), testContext);
});

describe('logging in with the second step on', () => {
	it('sends the person from the password step to the code step, keeping where they were going', async () => {
		expect((await afterPassword()).step.thrown).toMatchObject({
			status: 303,
			location: '/login/two-step'
		});
		expect((await afterPassword('?next=%2Fsettings%2Fprofile')).step.thrown).toMatchObject({
			location: '/login/two-step?next=%2Fsettings%2Fprofile'
		});
	});

	it('signs in with the app’s code and goes on to the page that was wanted', async () => {
		const { jar } = await afterPassword();

		const { thrown } = await outcome(() =>
			actions.default(
				event(
					jar,
					{ method: 'app', code: authenticatorCode(setupKey) },
					'/login/two-step?next=%2Fsettings'
				)
			)
		);

		expect(thrown).toMatchObject({ status: 303, location: '/settings' });
		expect(await getSessionUser(jar.headers())).toMatchObject({ email });
	});

	it('signs in with a backup code', async () => {
		const { jar } = await afterPassword();

		const { thrown } = await outcome(() =>
			actions.default(event(jar, { method: 'backup', code: backupCodes[0] }))
		);

		expect(thrown).toMatchObject({ status: 303, location: '/' });
		expect(await getSessionUser(jar.headers())).not.toBeNull();
	});

	it('refuses a wrong code without sending it back', async () => {
		const { jar } = await afterPassword();

		const { result } = await outcome(() =>
			actions.default(event(jar, { method: 'app', code: '123456' }))
		);

		expect(result).toMatchObject({ status: 400, data: { method: 'app', codeWrong: true } });
		expect(JSON.stringify(result)).not.toContain('123456');
		expect(await getSessionUser(jar.headers())).toBeNull();
	});

	it('sends anyone who has not passed the password step back to log in', async () => {
		const stranger = new TestCookieJar();

		expect((await outcome(() => load(event(stranger)))).thrown).toMatchObject({
			status: 303,
			location: '/login'
		});
		expect(
			(
				await outcome(() =>
					actions.default(event(stranger, { method: 'app', code: authenticatorCode(setupKey) }))
				)
			).thrown
		).toMatchObject({ status: 303, location: '/login' });
		expect(await getSessionUser(stranger.headers())).toBeNull();
	});

	it('shows the code page to someone who has just entered the right password', async () => {
		const { jar } = await afterPassword();

		expect((await outcome(() => load(event(jar)))).result).toEqual({});
	});
});

describe('logging in with the right password is otherwise unchanged', () => {
	it('for someone without the second step', async () => {
		await createSignedInUser('bo@example.com', 'Bo Lind');
		const jar = new TestCookieJar();

		expect(
			await logIn({ email: 'bo@example.com', password }, jar, {
				...testContext,
				ipAddress: '198.51.100.9'
			})
		).toEqual({ status: 'signed_in' });
	});
});
