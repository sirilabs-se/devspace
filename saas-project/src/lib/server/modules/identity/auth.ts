import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sendVerificationEmail } from './emails';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';
import { accounts, sessions, users, verifications } from './schema';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameFormatProblem } from './username';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

/** The address the app is reached at, used to build links in emails. */
export function appOrigin(): string {
	if (!env.ORIGIN) throw new Error('ORIGIN is not set');
	return env.ORIGIN.replace(/\/$/, '');
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
			autoSignIn: false
		},
		emailVerification: {
			sendOnSignUp: true,
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
