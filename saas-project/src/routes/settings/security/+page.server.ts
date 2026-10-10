import { fail, redirect } from '@sveltejs/kit';
import {
	confirmTwoStepSetup,
	getProfile,
	isTwoStepOn,
	listConnections,
	listPasskeys,
	listSecurityActivity,
	regenerateBackupCodes,
	removePasskey,
	renamePasskey,
	requireUser,
	signOutEverywhere,
	startTwoStepSetup,
	turnOffTwoStep
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const activity = await listSecurityActivity(user.id);

	return {
		timeZone: (await getProfile(user.id)).timeZone,
		twoStepOn: await isTwoStepOn(user.id),
		hasPassword: (await listConnections(user.id)).hasPassword,
		passkeys: (await listPasskeys(user.id)).map((passkey) => ({
			...passkey,
			createdAt: passkey.createdAt.toISOString()
		})),
		activity: activity.map((event) => ({ ...event, at: event.at.toISOString() }))
	};
};

export const actions: Actions = {
	startTwoStep: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await startTwoStepSetup(user, request.headers, form.get('password'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'started') return fail(400, { twoStepError: result.status });
		// Shown once, while the person sets up their app and saves the codes.
		return {
			twoStepSetup: {
				totpUri: result.totpUri,
				setupKey: result.setupKey,
				backupCodes: result.backupCodes
			}
		};
	},

	confirmTwoStep: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await confirmTwoStepSetup(user, request.headers, cookies, form.get('code'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'on') return fail(400, { twoStepError: 'code_wrong' as const });
		return { twoStepTurnedOn: true as const };
	},

	newBackupCodes: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await regenerateBackupCodes(user, request.headers, form.get('password'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'done') return fail(400, { twoStepError: result.status });
		return { newBackupCodes: result.backupCodes };
	},

	turnOffTwoStep: async ({ request, cookies, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await turnOffTwoStep(user, request.headers, cookies, form.get('password'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status !== 'off') return fail(400, { twoStepError: result.status });
		return { twoStepTurnedOff: true as const };
	},

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
