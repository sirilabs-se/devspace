import { error } from '@sveltejs/kit';
import { getUserForAdmin, requireRole } from '$lib/server/modules/identity';
import type { PageServerLoad } from './$types';

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
