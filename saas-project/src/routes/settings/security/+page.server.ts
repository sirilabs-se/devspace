import { fail, redirect } from '@sveltejs/kit';
import {
	getProfile,
	listPasskeys,
	listSecurityActivity,
	removePasskey,
	renamePasskey,
	requireUser,
	signOutEverywhere
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const activity = await listSecurityActivity(user.id);

	return {
		timeZone: (await getProfile(user.id)).timeZone,
		passkeys: (await listPasskeys(user.id)).map((passkey) => ({
			...passkey,
			createdAt: passkey.createdAt.toISOString()
		})),
		activity: activity.map((event) => ({ ...event, at: event.at.toISOString() }))
	};
};

export const actions: Actions = {
	renamePasskey: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await renamePasskey(user.id, form.get('passkeyId'), form.get('name'));

		if (result.status !== 'renamed') return fail(400, { passkeyError: result.status });
		return { passkeyRenamed: true as const };
	},

	removePasskey: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await removePasskey(user.id, form.get('passkeyId'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'removed') return fail(400, { passkeyError: result.status });
		return { passkeyRemoved: true as const };
	},

	signOutEverywhere: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);

		await signOutEverywhere(user, request.headers, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});
		redirect(303, '/login');
	}
};
