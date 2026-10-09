import { fail, redirect } from '@sveltejs/kit';
import { signUp, socialProviders, startSocialSignIn } from '$lib/server/modules/identity';
import { rememberPendingEmail } from '$lib/server/pending-email';
import type { Actions, PageServerLoad } from './$types';

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const load: PageServerLoad = () => {
	return { providers: socialProviders() };
};

export const actions: Actions = {
	// Sends the person to Google or Facebook to sign in there.
	social: async ({ request, cookies }) => {
		const form = await request.formData();
		const started = await startSocialSignIn(form.get('provider'), cookies);
		if (!started) return fail(400, { socialError: 'unavailable' as const });
		redirect(303, started.url);
	},

	register: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();

		const result = await signUp(
			{
				name: form.get('name'),
				username: form.get('username'),
				email: form.get('email'),
				password: form.get('password'),
				acceptTerms: form.get('acceptTerms') === 'on'
			},
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		const email = text(form.get('email')).trim();

		if (!result.ok && 'rateLimited' in result) {
			return fail(429, {
				rateLimited: true as const,
				retryAfterSeconds: result.retryAfterSeconds,
				values: { name: text(form.get('name')), username: text(form.get('username')), email }
			});
		}

		if (!result.ok) {
			return fail(400, {
				errors: result.errors,
				// The password is never sent back.
				values: { name: text(form.get('name')), username: text(form.get('username')), email }
			});
		}

		// The same next page whether or not the address was already registered. It shows the
		// address the person typed, which says nothing about who has an account.
		rememberPendingEmail(cookies, email);
		redirect(303, '/verify-email');
	}
};
