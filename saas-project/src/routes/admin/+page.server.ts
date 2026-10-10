import { redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/modules/identity';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireRole(locals.user, 'admin');
	redirect(303, '/admin/users');
};
