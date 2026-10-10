import { assertNotImpersonating } from './impersonation';
import { APIError } from 'better-auth/api';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth, SOCIAL_PROVIDERS, type SocialProvider } from './auth';
import { sendPasswordChangedEmail } from './emails';
import { passwordProblem } from './password';
import type { RequestContext } from './request-context';
import { accounts, passkeys } from './schema';
import {
	applySessionCookies,
	assertSessionBelongsTo,
	type CookieJar,
	type SessionUser
} from './session';
import { socialProviders } from './social';
import type { UserId } from './user-id';

export type Connections = {
	/** Whether the person can sign in with a password. */
	hasPassword: boolean;
	providers: { provider: SocialProvider; connected: boolean; connectedAt: Date | null }[];
};

/** The acting user's ways of signing in: a password, and each provider that is offered or connected. */
export async function listConnections(userId: UserId): Promise<Connections> {
	const rows = await db
		.select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
		.from(accounts)
		.where(eq(accounts.userId, userId));

	const offered = socialProviders();
	return {
		hasPassword: rows.some((row) => row.providerId === 'credential'),
		providers: SOCIAL_PROVIDERS.filter(
			(provider) => offered.includes(provider) || rows.some((row) => row.providerId === provider)
		).map((provider) => {
			const row = rows.find((candidate) => candidate.providerId === provider);
			return { provider, connected: !!row, connectedAt: row?.createdAt ?? null };
		})
	};
}

/** How many ways the user has to sign in: a password, providers and passkeys. The last one can never be removed. */
export async function signInMethodCount(userId: UserId): Promise<number> {
	const accountRows = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(eq(accounts.userId, userId));
	const passkeyRows = await db
		.select({ id: passkeys.id })
		.from(passkeys)
		.where(eq(passkeys.userId, userId));
	return accountRows.length + passkeyRows.length;
}

const asProvider = (value: unknown) => SOCIAL_PROVIDERS.find((provider) => provider === value);

/**
 * Starts connecting Google or Facebook to the acting user's account. Returns
 * the provider's address to send them to, or null if that provider isn't offered.
 */
export async function startLinkingProvider(
	user: SessionUser,
	provider: unknown,
	headers: Headers,
	cookies: CookieJar
): Promise<{ url: string } | null> {
	await assertSessionBelongsTo(user, headers);
	assertNotImpersonating(user);
	const name = asProvider(provider);
	if (!name || !socialProviders().includes(name)) return null;

	const { headers: responseHeaders, response } = await getAuth().api.linkSocialAccount({
		headers,
		body: {
			provider: name,
			callbackURL: `/settings/connections?connected=${name}`,
			errorCallbackURL: '/settings/connections',
			disableRedirect: true
		},
		returnHeaders: true
	});
	applySessionCookies(responseHeaders, cookies);
	return response.url ? { url: response.url } : null;
}

export type UnlinkProviderResult =
	{ status: 'unlinked' } | { status: 'not_connected' } | { status: 'last_method' };

/** Disconnects a provider from the acting user's account, unless it is their last way to sign in. */
export async function unlinkProvider(
	user: SessionUser,
	provider: unknown,
	headers: Headers,
	context: RequestContext
): Promise<UnlinkProviderResult> {
	await assertSessionBelongsTo(user, headers);
	assertNotImpersonating(user);
	const name = asProvider(provider);
	const connections = await listConnections(user.id);
	if (!name || !connections.providers.some((entry) => entry.provider === name && entry.connected)) {
		return { status: 'not_connected' };
	}
	if ((await signInMethodCount(user.id)) <= 1) return { status: 'last_method' };

	// Looked up by the acting user's ID, so only their own connection can be named.
	const [account] = await db
		.select({ id: accounts.id })
		.from(accounts)
		.where(and(eq(accounts.userId, user.id), eq(accounts.providerId, name)));
	if (!account) return { status: 'not_connected' };

	try {
		await getAuth().api.unlinkAccount({ headers, body: { accountId: account.id } });
	} catch (error) {
		// The library refuses too if this is the last sign-in method.
		if (error instanceof APIError) return { status: 'last_method' };
		throw error;
	}

	await recordAuditEvent(user.id, 'provider_unlinked', user.id, {
		...context,
		details: { provider: name }
	});
	return { status: 'unlinked' };
}

export type SetFirstPasswordResult =
	| { status: 'done' }
	| { status: 'already_has_password' }
	| { status: 'password_too_weak' | 'password_too_long' | 'passwords_differ' };

const firstPasswordSchema = z.object({ password: z.string(), confirmPassword: z.string() });

/**
 * Gives a password to someone who has only ever signed in with a provider.
 * People who already have one change it with `changePassword`, which asks for the current one.
 */
export async function setFirstPassword(
	user: SessionUser,
	headers: Headers,
	input: unknown,
	context: RequestContext
): Promise<SetFirstPasswordResult> {
	await assertSessionBelongsTo(user, headers);
	assertNotImpersonating(user);
	if ((await listConnections(user.id)).hasPassword) return { status: 'already_has_password' };

	const parsed = firstPasswordSchema.safeParse(input);
	if (!parsed.success) return { status: 'password_too_weak' };
	const problem = passwordProblem(parsed.data.password);
	if (problem) return { status: `password_${problem}` };
	if (parsed.data.password !== parsed.data.confirmPassword) return { status: 'passwords_differ' };

	await getAuth().api.setPassword({ headers, body: { newPassword: parsed.data.password } });

	await recordAuditEvent(user.id, 'password_set', user.id, context);
	await sendPasswordChangedEmail(user.email, appOrigin());
	return { status: 'done' };
}
