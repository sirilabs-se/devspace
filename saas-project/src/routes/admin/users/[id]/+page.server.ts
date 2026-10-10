import { error, fail, redirect } from '@sveltejs/kit';
import {
	getUserForAdmin,
	reinstateUser,
	requireRole,
	startImpersonation,
	suspendUser
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, request, getClientAddress }) => {
	const admin = requireRole(locals.user, 'admin');

	const user = await getUserForAdmin(admin, params.id, {
		ipAddress: getClientAddress(),
		userAgent: request.headers.get('user-agent')
	});
	if (!user) error(404, { message: 'No such user' });

	return {
		user: {
			...user,
			createdAt: user.createdAt.toISOString(),
			deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
			recentActivity: user.recentActivity.map((event) => ({
				...event,
				at: event.at.toISOString()
			}))
		}
	};
};

export const actions: Actions = {
	impersonate: async ({ request, cookies, locals, params, getClientAddress }) => {
		const admin = requireRole(locals.user, 'admin');

		const result = await startImpersonation(admin, request.headers, cookies, params.id, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'started') return fail(400, { adminError: result.status });
		// From here the browser is signed in as the user.
		redirect(303, '/');
	},

	suspend: async ({ request, locals, params, getClientAddress }) => {
		const admin = requireRole(locals.user, 'admin');
		const form = await request.formData();

		const result = await suspendUser(admin, params.id, form.get('reason'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'suspended') return fail(400, { adminError: result.status });
		return { suspended: true as const };
	},

	reinstate: async ({ request, locals, params, getClientAddress }) => {
		const admin = requireRole(locals.user, 'admin');

		const result = await reinstateUser(admin, params.id, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'reinstated') return fail(400, { adminError: result.status });
		return { reinstated: true as const };
	}
};
