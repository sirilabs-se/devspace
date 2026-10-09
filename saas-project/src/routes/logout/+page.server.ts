import { redirect } from '@sveltejs/kit';
import { logOut } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

// Signing out changes something, so it only happens on a submitted form, never by visiting a link.
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		await logOut(request.headers, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});
		redirect(303, '/');
	}
};
