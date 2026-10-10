import { requireRole } from '$lib/server/modules/identity';
import type { LayoutServerLoad } from './$types';

// Every page under /admin is for admins only. hooks.server.ts refuses others
// first; this is the second check, and each admin function makes a third.
export const load: LayoutServerLoad = ({ locals }) => {
	requireRole(locals.user, 'admin');
	return {};
};
