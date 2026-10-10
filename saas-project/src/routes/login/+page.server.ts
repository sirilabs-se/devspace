import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	logIn,
	resendVerificationEmail,
	socialProviders,
	startSocialSignIn
} from '$lib/server/modules/identity';
import { safeNextPath } from '$lib/server/next-path';
import { rememberPendingEmail } from '$lib/server/pending-email';
import type { Actions, PageServerLoad } from './$types';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNextPath(url.searchParams.get('next')));
	return {
		providers: socialProviders(),
		// Where to go after a passkey sign-in, which finishes in the browser.
		next: safeNextPath(url.searchParams.get('next')),
		// Set when Google or Facebook sent the person back with a problem.
		socialError: url.searchParams.get('error'),
		// Set after asking to delete an account.
		notice: url.searchParams.get('notice')
	};
};

export const actions: Actions = {
	// Sends the person to Google or Facebook to sign in there.
	social: async ({ request, cookies }) => {
		const form = await request.formData();
		const started = await startSocialSignIn(form.get('provider'), cookies);
		if (!started) return fail(400, { socialError: 'unavailable' as const });
		redirect(303, started.url);
	},

	// Step 1. Every well-formed email gets the same answer: on to the password step.
	// Nothing is looked up, so this step can't reveal who has an account.
	email: async ({ request }) => {
		const form = await request.formData();
		const parsed = emailSchema.safeParse(form.get('email'));

		if (!parsed.success) {
			return fail(400, {
				step: 'email' as const,
				email: text(form.get('email')),
				emailError: true
			});
		}
		return { step: 'password' as const, email: parsed.data };
	},

	// Step 2.
	password: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const email = text(form.get('email'));

		const result = await logIn(
			{ email, password: form.get('password'), rememberMe: form.get('rememberMe') === 'on' },
			cookies,
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (result.status === 'signed_in') redirect(303, safeNextPath(url.searchParams.get('next')));
		if (result.status === 'unverified') return { step: 'unverified' as const, email };
		if (result.status === 'rate_limited') {
			return fail(429, {
				step: 'paused' as const,
				email,
				retryAfterSeconds: result.retryAfterSeconds
			});
		}
		return fail(400, { step: 'password' as const, email, invalid: true });
	},

	// From the "verify your email to continue" screen.
	resend: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();
		const email = text(form.get('email'));

		rememberPendingEmail(cookies, email);
		await resendVerificationEmail(email, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});
		redirect(303, '/verify-email');
	}
};
