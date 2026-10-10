import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, twoFactor, username } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { cancelPendingDeletion } from './deletion-cancel';
import {
	sendEmailChangeVerificationEmail,
	sendPasswordResetEmail,
	sendTwoStepCodeEmail,
	sendVerificationEmail
} from './emails';
import { linkTokenPayload } from './link-token';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';
import { accounts, passkeys, sessions, twoFactors, users, verifications } from './schema';
import { toUserId } from './user-id';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameFormatProblem } from './username';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

/** A second-step code sent by email works for this many minutes. */
export const TWO_STEP_EMAIL_CODE_MINUTES = 10;

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
			schema: { users, accounts, sessions, verifications, passkeys, twoFactors }
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
		user: { changeEmail: { enabled: true } },
		socialProviders: configuredSocialProviders(),
		account: {
			// A provider sign-in is never merged into an existing account just because the
			// email matches. The person signs in first and links the provider from settings.
			// Linking is only ever done on purpose, by someone already signed in, so the
			// provider account may use a different email from the app account.
			// Whether a sign-in method is the last one is decided by this module, which also
			// counts passkeys; the library only counts provider and password accounts.
			accountLinking: {
				enabled: true,
				disableImplicitLinking: true,
				allowDifferentEmails: true,
				allowUnlinkingAll: true
			}
		},
		databaseHooks: {
			session: {
				create: {
					// Signing in, by any method, cancels a pending account deletion.
					after: async (session) => {
						await cancelPendingDeletion(toUserId(session.userId));
					}
				}
			},
			account: {
				create: {
					// Records every Google or Facebook account connected to a user.
					after: async (account) => {
						if (account.providerId === 'credential') return;
						const userId = toUserId(account.userId);
						await recordAuditEvent(userId, 'provider_linked', userId, {
							details: { provider: account.providerId }
						});
					}
				}
			}
		},
		hooks: {
			// Records sign-ins that come back from Google or Facebook.
			after: createAuthMiddleware(async (ctx) => {
				const userAgent = ctx.request?.headers.get('user-agent') ?? null;

				// Sign-ins that the library completes itself: a provider's return, or a passkey.
				const created = ctx.context.newSession;
				const method = ctx.path?.startsWith('/callback/')
					? String(ctx.params?.id ?? 'provider')
					: ctx.path === '/passkey/verify-authentication'
						? 'passkey'
						: null;
				if (created && method) {
					const userId = toUserId(created.user.id);
					await recordAuditEvent(userId, 'login', userId, { userAgent, details: { method } });
				}

				if (ctx.path === '/passkey/verify-registration' && ctx.context.session) {
					const failed = ctx.context.returned instanceof Error;
					const userId = toUserId(ctx.context.session.user.id);
					if (!failed) await recordAuditEvent(userId, 'passkey_added', userId, { userAgent });
				}
			})
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: ONE_DAY_IN_SECONDS,
			sendVerificationEmail: async ({ user, token }) => {
				const url = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
				// The same kind of link confirms a new sign-up and a change of email.
				if (linkTokenPayload(token)?.updateTo) {
					await sendEmailChangeVerificationEmail(user.email, url);
				} else {
					await sendVerificationEmail(user.email, url);
				}
			}
		},
		plugins: [
			// Roles, suspension and impersonation. Its own web addresses stay closed; the
			// admin area uses this module's functions.
			admin({ defaultRole: 'user', adminRoles: ['admin'] }),
			// The optional second step after a password login.
			twoFactor({
				issuer: 'SaaS',
				otpOptions: {
					// A code by email, as another way to complete the second step.
					period: TWO_STEP_EMAIL_CODE_MINUTES,
					storeOTP: 'hashed',
					sendOTP: async ({ user, otp }) => {
						await sendTwoStepCodeEmail(user.email, otp, TWO_STEP_EMAIL_CODE_MINUTES);
					}
				},
				// "Trust this device" skips the second step on that browser for 30 days.
				trustDeviceMaxAge: 30 * ONE_DAY_IN_SECONDS
			}),
			passkey({
				rpID: new URL(appOrigin()).hostname,
				rpName: 'SaaS',
				origin: appOrigin()
			}),
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
