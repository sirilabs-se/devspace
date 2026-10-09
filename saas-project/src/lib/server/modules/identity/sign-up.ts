import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin, getAuth } from './auth';
import { sendExistingAccountEmail } from './emails';
import { passwordProblem } from './password';
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

const NAME_MAX_LENGTH = 100;

export type SignUpField = 'name' | 'email' | 'password' | 'username' | 'acceptTerms';

export type SignUpErrorCode =
	| 'name_required'
	| 'name_too_long'
	| 'email_invalid'
	| 'password_too_weak'
	| 'password_too_long'
	| 'username_invalid'
	| 'username_reserved'
	| 'username_taken'
	| 'terms_required';

export type SignUpErrors = Partial<Record<SignUpField, SignUpErrorCode>>;

/**
 * "ok" means "check your inbox". It is returned whether or not the email
 * already has an account, so the response never reveals who is registered.
 */
export type SignUpResult = { ok: true } | { ok: false; errors: SignUpErrors };

const signUpSchema = z.object({
	name: z
		.string({ error: 'name_required' })
		.trim()
		.min(1, { error: 'name_required' })
		.max(NAME_MAX_LENGTH, { error: 'name_too_long' }),
	email: z
		.string({ error: 'email_invalid' })
		.trim()
		.toLowerCase()
		.pipe(z.email({ error: 'email_invalid' }).max(254, { error: 'email_invalid' })),
	password: z.string({ error: 'password_too_weak' }).superRefine((password, context) => {
		const problem = passwordProblem(password);
		if (problem) context.addIssue({ code: 'custom', message: `password_${problem}` });
	}),
	// Optional: an empty or missing username means the person has none.
	username: z
		.string({ error: 'username_invalid' })
		.trim()
		.nullish()
		.transform((value) => value || undefined),
	// One checkbox covers the terms, the privacy policy and being 18 or older.
	acceptTerms: z.literal(true, { error: 'terms_required' })
});

function validationErrors(error: z.ZodError): SignUpErrors {
	const errors: SignUpErrors = {};
	for (const issue of error.issues) {
		const field = issue.path[0] as SignUpField;
		errors[field] ??= issue.message as SignUpErrorCode;
	}
	return errors;
}

/** Reads the username out of unchecked input, so it can be checked even when other fields fail. */
function usernameFrom(input: unknown): string | undefined {
	const parsed = signUpSchema.shape.username.safeParse(
		typeof input === 'object' && input !== null && 'username' in input ? input.username : undefined
	);
	return parsed.success ? parsed.data : undefined;
}

/** Registers a new account and sends the verification email. */
export async function signUp(input: unknown, context: RequestContext): Promise<SignUpResult> {
	const parsed = signUpSchema.safeParse(input);
	const errors = parsed.success ? {} : validationErrors(parsed.error);

	const requestedUsername = usernameFrom(input);
	if (requestedUsername && !errors.username) {
		const availability = await checkUsernameAvailable(requestedUsername);
		if (!availability.available) errors.username = `username_${availability.reason}`;
	}

	if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };

	const { name, email, password, username } = parsed.data;

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
			body: { email, password, name, ...(username ? { username } : {}) }
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
