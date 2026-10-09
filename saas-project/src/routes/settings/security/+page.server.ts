import { redirect } from '@sveltejs/kit';
import {
	getProfile,
	listSecurityActivity,
	requireUser,
	signOutEverywhere
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const activity = await listSecurityActivity(user.id);

	return {
		timeZone: (await getProfile(user.id)).timeZone,
		activity: activity.map((event) => ({ ...event, at: event.at.toISOString() }))
	};
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
