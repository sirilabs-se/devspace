import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { logIn, resendVerificationEmail } from '$lib/server/modules/identity';
import { safeNextPath } from '$lib/server/next-path';
import { rememberPendingEmail } from '$lib/server/pending-email';
import type { Actions, PageServerLoad } from './$types';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNextPath(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
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
