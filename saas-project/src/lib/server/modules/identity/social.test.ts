import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import {
	createSignedInUser,
	TestCookieJar,
	testContext
} from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { accounts, auditEvents, consents, sessions, users } from './schema';
import { applySessionCookies, getSessionUser } from './session';
import { completeWelcome, handleAuthRequest, socialProviders, startSocialSignIn } from './social';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

type Person = { id: string; email: string; name: string };

const unsignedJwt = (claims: object) =>
	['{"alg":"none"}', JSON.stringify(claims), '']
		.map((part) => Buffer.from(part).toString('base64url'))
		.join('.');

/** Stands in for Google's and Facebook's servers, which the tests must not call. */
function pretendProvidersKnow(person: Person) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: string | URL | Request) => {
			const url = String(input instanceof Request ? input.url : input);
			if (url.startsWith('https://oauth2.googleapis.com/token')) {
				return Response.json({
					access_token: 'google-access',
					token_type: 'Bearer',
					expires_in: 3600,
					id_token: unsignedJwt({
						sub: person.id,
						email: person.email,
						email_verified: true,
						name: person.name,
						picture: 'https://images.example/maya.jpg'
					})
				});
			}
			if (url.includes('graph.facebook.com') && url.includes('oauth/access_token')) {
				return Response.json({
					access_token: 'facebook-access',
					token_type: 'bearer',
					expires_in: 3600
				});
			}
			if (url.startsWith('https://graph.facebook.com/debug_token')) {
				return Response.json({
					data: { is_valid: true, app_id: 'test-facebook-client', user_id: person.id }
				});
			}
			if (url.startsWith('https://graph.facebook.com/me')) {
				return Response.json({
					id: person.id,
					name: person.name,
					email: person.email,
					email_verified: true,
					picture: { data: { url: 'https://images.example/maya.jpg' } }
				});
			}
			throw new Error(`Unexpected request to ${url}`);
		})
	);
}

/** Goes through a provider sign-in: start, "sign in there", come back. */
async function signInWith(
	provider: 'google' | 'facebook',
	person: Person,
	jar = new TestCookieJar()
) {
	pretendProvidersKnow(person);
	const started = await startSocialSignIn(provider, jar);
	const state = new URL(started!.url).searchParams.get('state');

	const response = await handleAuthRequest(
		new Request(`http://localhost:5173/api/auth/callback/${provider}?code=a-code&state=${state}`, {
			headers: jar.headers()
		})
	);
	applySessionCookies(response.headers, jar);
	return { jar, location: response.headers.get('location'), status: response.status };
}

const maya = { id: 'provider-id-1', email: 'maya@example.com', name: 'Maya Okafor' };

beforeEach(async () => {
	await resetDatabase();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('socialProviders', () => {
	it('offers the providers that have credentials set', () => {
		expect(socialProviders()).toEqual(['google', 'facebook']);
	});
});

describe('startSocialSignIn', () => {
	it('sends the person to the provider with this app’s details', async () => {
		const jar = new TestCookieJar();

		const google = await startSocialSignIn('google', jar);
		const facebook = await startSocialSignIn('facebook', new TestCookieJar());

		const url = new URL(google!.url);
		expect(url.origin).toBe('https://accounts.google.com');
		expect(url.searchParams.get('client_id')).toBe('test-google-client');
		expect(url.searchParams.get('redirect_uri')).toBe(
			'http://localhost:5173/api/auth/callback/google'
		);
		expect(url.searchParams.get('state')).toBeTruthy();
		expect(jar.size).toBeGreaterThan(0);
		expect(new URL(facebook!.url).hostname).toMatch(/facebook\.com$/);
	});

	it('refuses a provider that is not offered', async () => {
		for (const provider of ['github', 'apple', '', null, 42]) {
			expect(await startSocialSignIn(provider, new TestCookieJar())).toBeNull();
		}
	});
});

describe('signing in with Google or Facebook', () => {
	for (const provider of ['google', 'facebook'] as const) {
		it(`creates an account and a session for a new person (${provider}), who still owes the welcome step`, async () => {
			const { jar, location } = await signInWith(provider, maya);

			expect(location).toBe('/welcome');
			const user = await getSessionUser(jar.headers());
			expect(user).toMatchObject({
				name: 'Maya Okafor',
				email: 'maya@example.com',
				username: null,
				image: 'https://images.example/maya.jpg',
				welcomePending: true
			});

			const [account] = await db.select().from(accounts);
			expect(account).toMatchObject({ providerId: provider, accountId: 'provider-id-1' });
			expect(account.password).toBeNull();
			expect(await db.select().from(consents)).toHaveLength(0);

			const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'login'));
			expect(event).toMatchObject({ subjectUserId: user!.id, details: { method: provider } });
		});
	}

	it('signs a returning person in to the same account', async () => {
		const first = await signInWith('google', maya);
		const firstUser = await getSessionUser(first.jar.headers());

		const again = await signInWith('google', maya);

		expect((await getSessionUser(again.jar.headers()))?.id).toBe(firstUser!.id);
		expect(await db.select().from(users)).toHaveLength(1);
	});

	it('does not sign anyone in to an existing account that merely has the same email', async () => {
		await createSignedInUser('maya@example.com', 'Maya With Password');
		await db.delete(sessions);

		const { jar, location } = await signInWith('google', maya);

		expect(location).toBe('/login?error=account_not_linked');
		expect(await getSessionUser(jar.headers())).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(await db.select().from(users)).toHaveLength(1);
		expect((await db.select().from(accounts)).map((account) => account.providerId)).toEqual([
			'credential'
		]);
	});

	it('refuses an answer that doesn’t match an attempt started here', async () => {
		pretendProvidersKnow(maya);

		const response = await handleAuthRequest(
			new Request('http://localhost:5173/api/auth/callback/google?code=a-code&state=made-up')
		);

		expect(response.headers.get('set-cookie') ?? '').not.toMatch(/session_token=[^;]+\S/);
		expect(await db.select().from(users)).toHaveLength(0);
	});
});

describe('handleAuthRequest', () => {
	it('answers "not found" for every login-library address except the two return addresses', async () => {
		for (const path of [
			'/api/auth/sign-up/email',
			'/api/auth/sign-in/email',
			'/api/auth/sign-in/social',
			'/api/auth/get-session',
			'/api/auth/reset-password',
			'/api/auth/change-password',
			'/api/auth/delete-user',
			'/api/auth/callback/github',
			'/api/auth/callback/google/extra',
			'/api/auth/ok'
		]) {
			for (const method of ['GET', 'POST']) {
				const response = await handleAuthRequest(
					new Request(`http://localhost:5173${path}`, { method })
				);
				expect(response.status, `${method} ${path}`).toBe(404);
			}
		}
		expect(await db.select().from(users)).toHaveLength(0);
	});
});

describe('completeWelcome', () => {
	it('records the consents and an optional username, after which the step is done', async () => {
		const { jar } = await signInWith('google', maya);
		const user = (await getSessionUser(jar.headers()))!;

		const result = await completeWelcome(
			user,
			{ acceptTerms: true, username: 'Maya.Okafor' },
			testContext
		);

		expect(result).toEqual({ ok: true });
		const after = await getSessionUser(jar.headers());
		expect(after).toMatchObject({ welcomePending: false, username: 'maya.okafor' });
		expect((await db.select().from(consents)).map((consent) => consent.document).sort()).toEqual([
			'age_confirmation',
			'privacy',
			'terms'
		]);
	});

	it('works without a username', async () => {
		const { jar } = await signInWith('google', maya);
		const user = (await getSessionUser(jar.headers()))!;

		expect(await completeWelcome(user, { acceptTerms: true, username: '' }, testContext)).toEqual({
			ok: true
		});
		expect(await getSessionUser(jar.headers())).toMatchObject({
			welcomePending: false,
			username: null
		});
	});

	it('requires the checkbox, and refuses a taken or reserved username, leaving the step open', async () => {
		await createSignedInUser('anna@example.com', 'Anna Berg');
		const { jar } = await signInWith('google', maya);
		const user = (await getSessionUser(jar.headers()))!;

		expect(await completeWelcome(user, { acceptTerms: false, username: '' }, testContext)).toEqual({
			ok: false,
			errors: { acceptTerms: 'terms_required' }
		});
		expect(
			await completeWelcome(user, { acceptTerms: true, username: 'admin' }, testContext)
		).toEqual({
			ok: false,
			errors: { username: 'username_reserved' }
		});
		expect((await getSessionUser(jar.headers()))?.welcomePending).toBe(true);
		expect(await db.select().from(consents).where(eq(consents.userId, user.id))).toHaveLength(0);
	});
});
