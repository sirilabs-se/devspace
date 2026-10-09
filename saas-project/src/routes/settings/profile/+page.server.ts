import { fail } from '@sveltejs/kit';
import {
	getProfile,
	LOCALES,
	requireUser,
	timeZones,
	updateProfile
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { profile: await getProfile(user.id), locales: [...LOCALES], timeZones: timeZones() };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const values = {
			name: form.get('name'),
			locale: form.get('locale'),
			timeZone: form.get('timeZone')
		};

		// The acting user comes from the session; the form can't name anyone else.
		const result = await updateProfile(user.id, values);

		if (!result.ok) return fail(400, { errors: result.errors });
		return { saved: true as const };
	}
};
