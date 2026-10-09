import { fail } from '@sveltejs/kit';
import { changePassword, requireUser } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return { email: user.email };
};

export const actions: Actions = {
	changePassword: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await changePassword(
			user,
			request.headers,
			cookies,
			{
				currentPassword: form.get('currentPassword'),
				password: form.get('password'),
				confirmPassword: form.get('confirmPassword')
			},
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (result.status === 'done') return { passwordChanged: true as const };
		if (result.status === 'rate_limited') {
			return fail(429, {
				passwordError: 'rate_limited' as const,
				retryAfterSeconds: result.retryAfterSeconds
			});
		}
		// No password is ever sent back.
		return fail(400, { passwordError: result.status });
	}
};
