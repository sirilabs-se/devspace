import { fail } from '@sveltejs/kit';
import {
	changeUsername,
	getProfile,
	LOCALES,
	requireUser,
	timeZones,
	updateProfile,
	usernameChangeAllowedAt
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const allowedAt = await usernameChangeAllowedAt(user.id);
	return {
		profile: await getProfile(user.id),
		locales: [...LOCALES],
		timeZones: timeZones(),
		// When the username may next be changed, or null if it may be changed now.
		usernameChangeAllowedAt: allowedAt?.toISOString() ?? null
	};
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
	},

	username: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await changeUsername(user.id, form.get('username'));

		if (result.status === 'changed' || result.status === 'unchanged') {
			return { usernameSaved: true as const };
		}
		if (result.status === 'too_soon') {
			return fail(400, {
				usernameError: 'too_soon' as const,
				allowedAt: result.allowedAt.toISOString()
			});
		}
		return fail(400, { usernameError: result.status });
	}
};
