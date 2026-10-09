import { fail } from '@sveltejs/kit';
import {
	changePassword,
	listConnections,
	requireUser,
	setFirstPassword
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { email: user.email, hasPassword: (await listConnections(user.id)).hasPassword };
};

export const actions: Actions = {
	// For people who have only ever signed in with Google or Facebook.
	setPassword: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await setFirstPassword(
			user,
			request.headers,
			{ password: form.get('password'), confirmPassword: form.get('confirmPassword') },
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (result.status === 'done') return { passwordChanged: true as const };
		return fail(400, { passwordError: result.status });
	},

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
