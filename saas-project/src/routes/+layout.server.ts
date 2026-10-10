import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		user: locals.user
			? {
					name: locals.user.name,
					isAdmin: locals.user.role === 'admin',
					// True while an admin is viewing the app as this person.
					impersonated: locals.user.impersonatedBy !== null
				}
			: null
	};
};
