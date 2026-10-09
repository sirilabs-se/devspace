import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { sendPasswordResetEmail, sendVerificationEmail } from './emails';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';
import { accounts, sessions, users, verifications } from './schema';
import { toUserId } from './user-id';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameFormatProblem } from './username';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

/** Password reset links work for one hour. */
export const RESET_LINK_SECONDS = 60 * 60;

/** With "remember me", a session lasts this long after it was last used. */
export const REMEMBERED_SESSION_SECONDS = 30 * ONE_DAY_IN_SECONDS;
/** However often it is used, a session ends this long after it started. */
export const SESSION_MAX_AGE_SECONDS = 90 * ONE_DAY_IN_SECONDS;

/** The address the app is reached at, used to build links in emails. */
export function appOrigin(): string {
	if (!env.ORIGIN) throw new Error('ORIGIN is not set');
	return env.ORIGIN.replace(/\/$/, '');
}

export const SOCIAL_PROVIDERS = ['google', 'facebook'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** The sign-in providers that have credentials set. A provider without them is simply not offered. */
export function configuredSocialProviders(): Partial<
	Record<SocialProvider, { clientId: string; clientSecret: string }>
> {
	const providers: Partial<Record<SocialProvider, { clientId: string; clientSecret: string }>> = {};
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		providers.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
	}
	if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET) {
		providers.facebook = {
			clientId: env.FACEBOOK_CLIENT_ID,
			clientSecret: env.FACEBOOK_CLIENT_SECRET
		};
	}
	return providers;
}

function createAuth() {
	if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');

	return betterAuth({
		baseURL: appOrigin(),
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: 'pg',
			usePlural: true,
			schema: { users, accounts, sessions, verifications }
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH,
			requireEmailVerification: true,
			autoSignIn: false,
			resetPasswordTokenExpiresIn: RESET_LINK_SECONDS,
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: async ({ user, token }) => {
				const url = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
				await sendPasswordResetEmail(user.email, url);
			}
		},
		// Without "remember me" the library ends the session after one day, and the
		// cookie goes when the browser closes.
		session: {
			expiresIn: REMEMBERED_SESSION_SECONDS,
			updateAge: ONE_DAY_IN_SECONDS
		},
		socialProviders: configuredSocialProviders(),
		account: {
			// A provider sign-in is never merged into an existing account just because the
			// email matches. The person signs in first and links the provider from settings.
			accountLinking: { enabled: true, disableImplicitLinking: true }
		},
		hooks: {
			// Records sign-ins that come back from Google or Facebook.
			after: createAuthMiddleware(async (ctx) => {
				const created = ctx.context.newSession;
				if (!ctx.path?.startsWith('/callback/') || !created) return;
				const userId = toUserId(created.user.id);
				await recordAuditEvent(userId, 'login', userId, {
					userAgent: ctx.request?.headers.get('user-agent') ?? null,
					details: { method: String(ctx.params?.id ?? 'provider') }
				});
			})
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: ONE_DAY_IN_SECONDS,
			sendVerificationEmail: async ({ user, token }) => {
				const url = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
				await sendVerificationEmail(user.email, url);
			}
		},
		plugins: [
			username({
				minUsernameLength: USERNAME_MIN_LENGTH,
				maxUsernameLength: USERNAME_MAX_LENGTH,
				usernameValidator: (value) => usernameFormatProblem(value) === null
			})
		],
		telemetry: { enabled: false }
	});
}

let auth: ReturnType<typeof createAuth> | undefined;

/** The login library, set up on first use so that building the app needs no secrets. */
export function getAuth() {
	auth ??= createAuth();
	return auth;
}
