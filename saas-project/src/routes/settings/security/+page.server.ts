import { redirect } from '@sveltejs/kit';
import { requireUser, signOutEverywhere } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return {};
};

export const actions: Actions = {
	signOutEverywhere: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);

		await signOutEverywhere(user, request.headers, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});
		redirect(303, '/login');
	}
};
