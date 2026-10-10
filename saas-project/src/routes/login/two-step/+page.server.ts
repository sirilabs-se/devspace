import { fail, redirect } from '@sveltejs/kit';
import { completeTwoStepLogin, hasTwoStepChallenge } from '$lib/server/modules/identity';
import { safeNextPath } from '$lib/server/next-path';
import type { Actions, PageServerLoad } from './$types';

// The second step of a password login, for people who have switched it on.
export const load: PageServerLoad = ({ request, locals, url }) => {
	if (locals.user) redirect(303, safeNextPath(url.searchParams.get('next')));
	// Only reachable straight after a correct password.
	if (!hasTwoStepChallenge(request.headers)) redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const method: 'app' | 'backup' = form.get('method') === 'backup' ? 'backup' : 'app';

		const result = await completeTwoStepLogin(method, form.get('code'), request.headers, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'signed_in') redirect(303, safeNextPath(url.searchParams.get('next')));
		if (result.status === 'no_challenge') redirect(303, '/login');
		if (result.status === 'rate_limited') {
			return fail(429, { method, rateLimited: true, retryAfterSeconds: result.retryAfterSeconds });
		}
		// The code is never sent back.
		return fail(400, { method, codeWrong: true });
	}
};
