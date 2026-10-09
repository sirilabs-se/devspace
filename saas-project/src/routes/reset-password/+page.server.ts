import { fail } from '@sveltejs/kit';
import { resetPassword, resetPasswordLinkState } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	return { link: await resetPasswordLinkState(token) };
};

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		const form = await request.formData();

		const result = await resetPassword(
			{
				token: url.searchParams.get('token'),
				password: form.get('password'),
				confirmPassword: form.get('confirmPassword')
			},
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (result.status === 'done') return { done: true as const };
		if (result.status === 'expired' || result.status === 'invalid') {
			return fail(400, { link: result.status });
		}
		// Neither password is ever sent back.
		return fail(400, { error: result.status });
	}
};
