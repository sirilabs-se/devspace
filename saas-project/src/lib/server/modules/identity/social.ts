import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { configuredSocialProviders, getAuth, SOCIAL_PROVIDERS, type SocialProvider } from './auth';
import type { RequestContext } from './request-context';
import { consents } from './schema';
import { applySessionCookies, type CookieJar, type SessionUser } from './session';
import { CONSENT_VERSIONS } from './sign-up';
import type { UserId } from './user-id';
import { changeUsername, type UsernameProblem } from './username';

export type { SocialProvider };

/** The providers people can sign in with, in the order they are shown. */
export function socialProviders(): SocialProvider[] {
	const configured = configuredSocialProviders();
	return SOCIAL_PROVIDERS.filter((provider) => configured[provider]);
}

/**
 * Starts a sign-in with Google or Facebook. Returns the provider's address to
 * send the person to, or null if that provider isn't available.
 */
export async function startSocialSignIn(
	provider: unknown,
	cookies: CookieJar
): Promise<{ url: string } | null> {
	const name = SOCIAL_PROVIDERS.find((candidate) => candidate === provider);
	if (!name || !socialProviders().includes(name)) return null;

	const { headers, response } = await getAuth().api.signInSocial({
		body: {
			provider: name,
			callbackURL: '/welcome',
			errorCallbackURL: '/login',
			disableRedirect: true
		},
		returnHeaders: true
	});
	// Remembers this attempt, so the provider's answer can be matched to it.
	applySessionCookies(headers, cookies);
	return response.url ? { url: response.url } : null;
}

// The only login-library addresses reachable from outside: where a provider
// sends people back. Everything else goes through this module's own functions,
// which apply the app's rules.
const ALLOWED_AUTH_PATHS = [
	/^\/api\/auth\/callback\/(google|facebook)$/,
	// The passkey exchange between the browser and the login library.
	/^\/api\/auth\/passkey\/(generate-register-options|verify-registration|generate-authenticate-options|verify-authentication)$/
];

/** Handles a request to `/api/auth/*`. Anything not on the short allowed list is "not found". */
export async function handleAuthRequest(request: Request): Promise<Response> {
	const { pathname } = new URL(request.url);
	if (!ALLOWED_AUTH_PATHS.some((allowed) => allowed.test(pathname))) {
		return new Response('Not found', { status: 404 });
	}
	return getAuth().handler(request);
}

/**
 * True for someone who signed in with a provider and hasn't yet accepted the
 * terms and confirmed their age. Until they do, they can only reach `/welcome`.
 */
export async function isWelcomePending(userId: UserId): Promise<boolean> {
	const [accepted] = await db
		.select({ id: consents.id })
		.from(consents)
		.where(and(eq(consents.userId, userId), eq(consents.document, 'terms')))
		.limit(1);
	return !accepted;
}

export type CompleteWelcomeResult =
	| { ok: true }
	| {
			ok: false;
			errors: { acceptTerms?: 'terms_required'; username?: `username_${UsernameProblem}` };
	  };

const welcomeSchema = z.object({
	acceptTerms: z.boolean(),
	username: z
		.string()
		.trim()
		.nullish()
		.transform((value) => value || undefined)
});

/** Finishes a provider sign-up: records the consents and, if given, sets a username. */
export async function completeWelcome(
	user: SessionUser,
	input: unknown,
	context: RequestContext
): Promise<CompleteWelcomeResult> {
	const parsed = welcomeSchema.safeParse(input);
	if (!parsed.success || !parsed.data.acceptTerms) {
		return { ok: false, errors: { acceptTerms: 'terms_required' } };
	}
	if (!(await isWelcomePending(user.id))) return { ok: true };

	if (parsed.data.username) {
		const result = await changeUsername(user.id, parsed.data.username);
		if (result.status === 'invalid' || result.status === 'reserved' || result.status === 'taken') {
			return { ok: false, errors: { username: `username_${result.status}` } };
		}
	}

	await db.transaction(async (tx) => {
		await tx.insert(consents).values(
			(Object.keys(CONSENT_VERSIONS) as (keyof typeof CONSENT_VERSIONS)[]).map((document) => ({
				userId: user.id,
				document,
				version: CONSENT_VERSIONS[document]
			}))
		);
		await recordAuditEvent(user.id, 'welcome_completed', user.id, { ...context, database: tx });
	});
	return { ok: true };
}
