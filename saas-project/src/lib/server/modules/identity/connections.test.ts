import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import {
	listConnections,
	setFirstPassword,
	startLinkingProvider,
	unlinkProvider
} from './connections';
import { logIn } from './log-in';
import { accounts, auditEvents, sessions } from './schema';
import { applySessionCookies, getSessionUser, type SessionUser } from './session';
import { handleAuthRequest, startSocialSignIn } from './social';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

type Person = { id: string; email: string; name: string };

const unsignedJwt = (claims: object) =>
	['{"alg":"none"}', JSON.stringify(claims), '']
		.map((part) => Buffer.from(part).toString('base64url'))
		.join('.');

/** Stands in for Google's servers, which the tests must not call. */
function pretendGoogleKnows(person: Person) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () =>
			Response.json({
				access_token: 'google-access',
				token_type: 'Bearer',
				expires_in: 3600,
				id_token: unsignedJwt({
					sub: person.id,
					email: person.email,
					email_verified: true,
					name: person.name
				})
			})
		)
	);
}

async function comeBackFromGoogle(url: string, jar: TestCookieJar) {
	const state = new URL(url).searchParams.get('state');
	const response = await handleAuthRequest(
		new Request(`http://localhost:5173/api/auth/callback/google?code=a-code&state=${state}`, {
			headers: jar.headers()
		})
	);
	applySessionCookies(response.headers, jar);
	return response.headers.get('location');
}

async function connectGoogle(user: SessionUser, jar: TestCookieJar, googleAccount: Person) {
	pretendGoogleKnows(googleAccount);
	const started = await startLinkingProvider(user, 'google', jar.headers(), jar);
	return comeBackFromGoogle(started!.url, jar);
}

const password = 'Correct-Horse-42';
const annasGoogle = { id: 'google-anna', email: 'anna@example.com', name: 'Anna Berg' };
const actions = async () =>
	(await db.select().from(auditEvents).orderBy(auditEvents.id)).map((event) => event.action);
const providersOf = async (user: SessionUser) =>
	(await db.select().from(accounts).where(eq(accounts.userId, user.id)))
		.map((account) => account.providerId)
		.sort();

let jar: TestCookieJar;
let anna: SessionUser;

beforeEach(async () => {
	await resetDatabase();
	jar = await createSignedInUser('anna@example.com', 'Anna Berg');
	anna = (await getSessionUser(jar.headers()))!;
	vi.mocked(sendEmail).mockClear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('listConnections', () => {
	it('shows a password and the offered providers, none connected yet', async () => {
		expect(await listConnections(anna.id)).toEqual({
			hasPassword: true,
			providers: [
				{ provider: 'google', connected: false, connectedAt: null },
				{ provider: 'facebook', connected: false, connectedAt: null }
			]
		});
	});
});

describe('connecting a provider', () => {
	it('connects Google, after which the person can sign in with it', async () => {
		const location = await connectGoogle(anna, jar, annasGoogle);

		expect(location).toBe('/settings/connections?connected=google');
		expect(await providersOf(anna)).toEqual(['credential', 'google']);
		expect((await listConnections(anna.id)).providers[0]).toMatchObject({
			provider: 'google',
			connected: true
		});
		expect(await actions()).toContain('provider_linked');

		// A fresh browser, signing in with Google, lands in the same account.
		await db.delete(sessions);
		const fresh = new TestCookieJar();
		const started = await startSocialSignIn('google', fresh);
		await comeBackFromGoogle(started!.url, fresh);
		expect((await getSessionUser(fresh.headers()))?.id).toBe(anna.id);
	});

	it('allows a Google account with a different email, since the person is already signed in', async () => {
		await connectGoogle(anna, jar, {
			id: 'google-other',
			email: 'a.berg@gmail.example',
			name: 'A'
		});

		expect(await providersOf(anna)).toEqual(['credential', 'google']);
	});

	it('refuses a Google account that is already connected to someone else', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;
		await connectGoogle(bo, boJar, { id: 'shared-google', email: 'bo@example.com', name: 'Bo' });

		const location = await connectGoogle(anna, jar, {
			id: 'shared-google',
			email: 'bo@example.com',
			name: 'Bo'
		});

		expect(location).toMatch(/^\/settings\/connections\?error=/);
		expect(await providersOf(anna)).toEqual(['credential']);
		expect(await providersOf(bo)).toEqual(['credential', 'google']);
	});

	it('refuses a provider that is not offered', async () => {
		expect(await startLinkingProvider(anna, 'github', jar.headers(), jar)).toBeNull();
	});
});

describe('disconnecting a provider', () => {
	it('disconnects when another way to sign in remains', async () => {
		await connectGoogle(anna, jar, annasGoogle);

		expect(await unlinkProvider(anna, 'google', jar.headers(), testContext)).toEqual({
			status: 'unlinked'
		});

		expect(await providersOf(anna)).toEqual(['credential']);
		expect(await actions()).toContain('provider_unlinked');
	});

	it('refuses to remove the only way to sign in', async () => {
		// Someone who signed up with Google and has no password.
		pretendGoogleKnows({ id: 'google-maya', email: 'maya@example.com', name: 'Maya' });
		const mayaJar = new TestCookieJar();
		const started = await startSocialSignIn('google', mayaJar);
		await comeBackFromGoogle(started!.url, mayaJar);
		const maya = (await getSessionUser(mayaJar.headers()))!;

		expect(await unlinkProvider(maya, 'google', mayaJar.headers(), testContext)).toEqual({
			status: 'last_method'
		});
		expect(await providersOf(maya)).toEqual(['google']);
	});

	it('says so when the provider is not connected', async () => {
		expect(await unlinkProvider(anna, 'google', jar.headers(), testContext)).toEqual({
			status: 'not_connected'
		});
		expect(await unlinkProvider(anna, 'nonsense', jar.headers(), testContext)).toEqual({
			status: 'not_connected'
		});
	});

	it('cannot disconnect another person’s provider', async () => {
		const boJar = await createSignedInUser('bo@example.com', 'Bo Lind');
		const bo = (await getSessionUser(boJar.headers()))!;
		await connectGoogle(bo, boJar, { id: 'google-bo', email: 'bo@example.com', name: 'Bo' });

		// Anna asks to disconnect Google: she has none, and Bo's is untouched.
		expect(await unlinkProvider(anna, 'google', jar.headers(), testContext)).toEqual({
			status: 'not_connected'
		});
		// Anna's session claiming to act as Bo is refused outright.
		await expect(unlinkProvider(bo, 'google', jar.headers(), testContext)).rejects.toThrow(
			/does not belong/
		);
		expect(await providersOf(bo)).toEqual(['credential', 'google']);
	});
});

describe('setFirstPassword', () => {
	async function googleOnlyUser() {
		pretendGoogleKnows({ id: 'google-maya', email: 'maya@example.com', name: 'Maya' });
		const mayaJar = new TestCookieJar();
		const started = await startSocialSignIn('google', mayaJar);
		await comeBackFromGoogle(started!.url, mayaJar);
		return { mayaJar, maya: (await getSessionUser(mayaJar.headers()))! };
	}

	it('gives a provider-only person a password, so Google can then be disconnected', async () => {
		const { maya, mayaJar } = await googleOnlyUser();
		expect((await listConnections(maya.id)).hasPassword).toBe(false);

		const result = await setFirstPassword(
			maya,
			mayaJar.headers(),
			{ password, confirmPassword: password },
			testContext
		);

		expect(result).toEqual({ status: 'done' });
		expect((await listConnections(maya.id)).hasPassword).toBe(true);
		expect(await actions()).toContain('password_set');
		expect(await unlinkProvider(maya, 'google', mayaJar.headers(), testContext)).toEqual({
			status: 'unlinked'
		});
		expect(
			await logIn({ email: 'maya@example.com', password }, new TestCookieJar(), {
				...testContext,
				ipAddress: '198.51.100.3'
			})
		).toEqual({ status: 'signed_in' });
	});

	it('follows the password rule and needs both entries to match', async () => {
		const { maya, mayaJar } = await googleOnlyUser();

		expect(
			await setFirstPassword(
				maya,
				mayaJar.headers(),
				{ password: 'weak', confirmPassword: 'weak' },
				testContext
			)
		).toEqual({ status: 'password_too_weak' });
		expect(
			await setFirstPassword(
				maya,
				mayaJar.headers(),
				{ password, confirmPassword: 'Other-Horse-9!' },
				testContext
			)
		).toEqual({ status: 'passwords_differ' });
		expect((await listConnections(maya.id)).hasPassword).toBe(false);
	});

	it('is not a way around the current-password check for someone who has a password', async () => {
		const result = await setFirstPassword(
			anna,
			jar.headers(),
			{ password: 'Brand-New-Horse-7', confirmPassword: 'Brand-New-Horse-7' },
			testContext
		);

		expect(result).toEqual({ status: 'already_has_password' });
		expect(
			await logIn({ email: 'anna@example.com', password }, new TestCookieJar(), {
				...testContext,
				ipAddress: '198.51.100.4'
			})
		).toEqual({ status: 'signed_in' });
	});
});
