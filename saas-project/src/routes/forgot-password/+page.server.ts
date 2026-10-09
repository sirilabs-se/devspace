import { fail } from '@sveltejs/kit';
import { requestPasswordReset } from '$lib/server/modules/identity';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const typed = form.get('email');
		const email = typeof typed === 'string' ? typed.trim() : '';

		const result = await requestPasswordReset(email, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'invalid_email') return fail(400, { email, emailError: true });
		if (result.status === 'rate_limited') {
			return fail(429, { email, rateLimited: true, retryAfterSeconds: result.retryAfterSeconds });
		}
		// The same answer whether or not the address has an account.
		return { sent: true as const, email };
	}
};
