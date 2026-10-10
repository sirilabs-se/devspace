import { fail, redirect } from '@sveltejs/kit';
import {
	changePassword,
	listConnections,
	requestAccountDeletion,
	requestEmailChange,
	requireUser,
	setFirstPassword
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { email: user.email, hasPassword: (await listConnections(user.id)).hasPassword };
};

export const actions: Actions = {
	deleteAccount: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await requestAccountDeletion(
			user,
			request.headers,
			cookies,
			{
				currentPassword: form.get('deletePassword'),
				confirmed: form.get('confirmDelete') === 'on'
			},
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (result.status !== 'scheduled') return fail(400, { deleteError: result.status });
		redirect(303, `/login?notice=deletion-scheduled`);
	},

	changeEmail: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const typed = form.get('newEmail');
		const newEmail = typeof typed === 'string' ? typed.trim() : '';

		const result = await requestEmailChange(
			user,
			request.headers,
			{ newEmail, currentPassword: form.get('emailPassword') ?? undefined },
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		// The same answer whether or not the new address already has an account.
		if (result.status === 'sent') return { emailSent: true as const, newEmail };
		if (result.status === 'rate_limited') {
			return fail(429, {
				emailError: 'rate_limited' as const,
				retryAfterSeconds: result.retryAfterSeconds,
				newEmail
			});
		}
		return fail(400, { emailError: result.status, newEmail });
	},

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
