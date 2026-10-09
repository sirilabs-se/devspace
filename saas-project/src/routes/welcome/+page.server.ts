import { fail, redirect } from '@sveltejs/kit';
import { completeWelcome, requireUser } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	// Only for people who still have the terms to accept.
	if (!user.welcomePending) redirect(303, '/');
	return { name: user.name, email: user.email };
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const typed = form.get('username');
		const username = typeof typed === 'string' ? typed : '';

		const result = await completeWelcome(
			user,
			{ acceptTerms: form.get('acceptTerms') === 'on', username },
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') }
		);

		if (!result.ok) return fail(400, { errors: result.errors, username });
		redirect(303, '/');
	}
};
