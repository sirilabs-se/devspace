import { fail } from '@sveltejs/kit';
import {
	AVATAR_MAX_BYTES,
	changeUsername,
	getProfile,
	LOCALES,
	removeAvatar,
	requireUser,
	setAvatar,
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

	photo: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const file = form.get('photo');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { photoError: 'empty' as const });
		}
		// Checked before reading the file into memory.
		if (file.size > AVATAR_MAX_BYTES) return fail(400, { photoError: 'too_large' as const });

		const result = await setAvatar(user.id, new Uint8Array(await file.arrayBuffer()));

		if (!result.ok) return fail(400, { photoError: result.error });
		return { photoSaved: true as const };
	},

	removePhoto: async ({ locals }) => {
		const user = requireUser(locals);
		await removeAvatar(user.id);
		return { photoRemoved: true as const };
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
