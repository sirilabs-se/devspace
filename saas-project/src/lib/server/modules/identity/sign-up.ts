import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth';
import { sendExistingAccountEmail } from './emails';
import type { RequestContext } from './request-context';
import { consents, users } from './schema';
import { toUserId } from './user-id';
import { checkUsernameAvailable } from './username';

/** The versions of the documents a person accepts when signing up. */
export const CONSENT_VERSIONS = {
	terms: '1',
	privacy: '1',
	age_confirmation: '1'
} as const;

export type SignUpField = 'email' | 'password' | 'username' | 'acceptTerms' | 'confirmAge';

export type SignUpErrorCode =
	| 'email_invalid'
	| 'password_too_short'
	| 'password_too_long'
	| 'username_invalid'
	| 'username_reserved'
	| 'username_taken'
	| 'terms_required'
	| 'age_required';

export type SignUpErrors = Partial<Record<SignUpField, SignUpErrorCode>>;

/**
 * "ok" means "check your email". It is returned whether or not the email
 * already has an account, so the response never reveals who is registered.
 */
export type SignUpResult = { ok: true } | { ok: false; errors: SignUpErrors };

const signUpSchema = z.object({
	email: z
		.string({ error: 'email_invalid' })
		.trim()
		.toLowerCase()
		.pipe(z.email({ error: 'email_invalid' }).max(254, { error: 'email_invalid' })),
	password: z
		.string({ error: 'password_too_short' })
		.min(PASSWORD_MIN_LENGTH, { error: 'password_too_short' })
		.max(PASSWORD_MAX_LENGTH, { error: 'password_too_long' }),
	username: z.string({ error: 'username_invalid' }).trim(),
	acceptTerms: z.literal(true, { error: 'terms_required' }),
	confirmAge: z.literal(true, { error: 'age_required' })
});

function validationErrors(error: z.ZodError): SignUpErrors {
	const errors: SignUpErrors = {};
	for (const issue of error.issues) {
		const field = issue.path[0] as SignUpField;
		errors[field] ??= issue.message as SignUpErrorCode;
	}
	return errors;
}

/** Registers a new account and sends the verification email. */
export async function signUp(input: unknown, context: RequestContext): Promise<SignUpResult> {
	const parsed = signUpSchema.safeParse(input);
	const errors = parsed.success ? {} : validationErrors(parsed.error);

	const usernameInput =
		typeof input === 'object' && input !== null && 'username' in input ? input.username : null;
	if (typeof usernameInput === 'string') {
		const availability = await checkUsernameAvailable(usernameInput);
		if (!availability.available) errors.username = `username_${availability.reason}`;
	}

	if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };

	const { email, password, username } = parsed.data;

	const [existing] = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing) {
		await sendExistingAccountEmail(existing.email, appOrigin());
		await recordAuditEvent(null, 'signup_existing_email', toUserId(existing.id), context);
		return { ok: true };
	}

	let userId: string;
	try {
		const created = await getAuth().api.signUpEmail({
			body: { email, password, name: username, username }
		});
		userId = created.user.id;
	} catch (error) {
		// Another sign-up took the username between the check above and now.
		if (error instanceof APIError && error.body?.code === 'USERNAME_IS_ALREADY_TAKEN') {
			return { ok: false, errors: { username: 'username_taken' } };
		}
		throw error;
	}

	try {
		await db.transaction(async (tx) => {
			await tx.insert(consents).values(
				(Object.keys(CONSENT_VERSIONS) as (keyof typeof CONSENT_VERSIONS)[]).map((document) => ({
					userId,
					document,
					version: CONSENT_VERSIONS[document]
				}))
			);
			await recordAuditEvent(toUserId(userId), 'signup', toUserId(userId), {
				...context,
				database: tx
			});
		});
	} catch (error) {
		// An account must never exist without its consent records.
		await db.delete(users).where(eq(users.id, userId));
		throw error;
	}

	return { ok: true };
}
