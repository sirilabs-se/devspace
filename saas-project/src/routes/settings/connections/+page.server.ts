import { fail, redirect } from '@sveltejs/kit';
import {
	listConnections,
	requireUser,
	startLinkingProvider,
	unlinkProvider
} from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const { hasPassword, providers } = await listConnections(user.id);

	return {
		hasPassword,
		providers: providers.map((entry) => ({
			provider: entry.provider,
			connected: entry.connected,
			connectedAt: entry.connectedAt?.toISOString() ?? null
		})),
		// Set when the person has just come back from Google or Facebook.
		justConnected: url.searchParams.get('connected'),
		connectError: url.searchParams.get('error')
	};
};

export const actions: Actions = {
	connect: async ({ request, cookies, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const started = await startLinkingProvider(
			user,
			form.get('provider'),
			request.headers,
			cookies
		);
		if (!started) return fail(400, { error: 'unavailable' as const });
		redirect(303, started.url);
	},

	disconnect: async ({ request, locals, getClientAddress }) => {
		const user = requireUser(locals);
		const form = await request.formData();

		const result = await unlinkProvider(user, form.get('provider'), request.headers, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'unlinked') return { disconnected: true as const };
		return fail(400, { error: result.status });
	}
};
