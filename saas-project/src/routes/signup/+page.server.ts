import { fail } from '@sveltejs/kit';
import { signUp } from '$lib/server/modules/identity';
import type { Actions } from './$types';

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
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

		// The address is only what the person just typed; it says nothing about who is registered.
		return { sent: true as const, email };
	}
};
