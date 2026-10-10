import { requireRole, searchUsers } from '$lib/server/modules/identity';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requireRole(locals.user, 'admin');
	const query = url.searchParams.get('q') ?? '';

	const result = await searchUsers(admin, query, url.searchParams.get('page') ?? 1);

	return {
		query,
		page: result.page,
		pageCount: result.pageCount,
		total: result.total,
		users: result.users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))
	};
};
