import { redirect } from '@sveltejs/kit';
import { requireUser, stopImpersonation } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

// Returns an admin from viewing the app as someone else to their own account.
// It lives outside /admin because, while viewing as a user, the admin area is closed.
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);

		const result = await stopImpersonation(user, request.headers, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		redirect(303, result.status === 'stopped' ? `/admin/users/${user.id}` : '/');
	}
};
