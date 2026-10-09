import { fail } from '@sveltejs/kit';
import { signUp } from '$lib/server/modules/identity';
import type { Actions } from './$types';

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();

		const result = await signUp(
			{
				email: form.get('email'),
				password: form.get('password'),
				username: form.get('username'),
				acceptTerms: form.get('acceptTerms') === 'on',
				confirmAge: form.get('confirmAge') === 'on'
			},
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (!result.ok) {
			return fail(400, {
				errors: result.errors,
				// The password is never sent back.
				values: { email: text(form.get('email')), username: text(form.get('username')) }
			});
		}

		return { sent: true as const };
	}
};
