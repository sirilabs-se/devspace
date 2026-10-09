import { fail, redirect } from '@sveltejs/kit';
import { signUp } from '$lib/server/modules/identity';
import { rememberPendingEmail } from '$lib/server/pending-email';
import type { Actions } from './$types';

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
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
