import { fail, redirect } from '@sveltejs/kit';
import {
	completeTwoStepLogin,
	hasTwoStepChallenge,
	sendTwoStepEmailCode,
	type TwoStepMethod
} from '$lib/server/modules/identity';
import { safeNextPath } from '$lib/server/next-path';
import type { Actions, PageServerLoad } from './$types';

const methodFrom = (value: FormDataEntryValue | null): TwoStepMethod =>
	value === 'backup' || value === 'email' ? value : 'app';

// The second step of a password login, for people who have switched it on.
export const load: PageServerLoad = ({ request, locals, url }) => {
	if (locals.user) redirect(303, safeNextPath(url.searchParams.get('next')));
	// Only reachable straight after a correct password.
	if (!hasTwoStepChallenge(request.headers)) redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	verify: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const method = methodFrom(form.get('method'));

		const result = await completeTwoStepLogin(
			method,
			form.get('code'),
			request.headers,
			cookies,
			{ ipAddress: getClientAddress(), userAgent: request.headers.get('user-agent') },
			form.get('trustDevice') === 'on'
		);

		if (result.status === 'signed_in') redirect(303, safeNextPath(url.searchParams.get('next')));
		if (result.status === 'no_challenge') redirect(303, '/login');
		if (result.status === 'rate_limited') {
			return fail(429, { method, rateLimited: true, retryAfterSeconds: result.retryAfterSeconds });
		}
		// The code is never sent back.
		return fail(400, { method, codeWrong: true });
	},

	// "Email me a code".
	sendEmailCode: async ({ request, getClientAddress }) => {
		const result = await sendTwoStepEmailCode(request.headers, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'no_challenge') redirect(303, '/login');
		if (result.status === 'rate_limited') {
			return fail(429, {
				method: 'email' as TwoStepMethod,
				rateLimited: true,
				retryAfterSeconds: result.retryAfterSeconds
			});
		}
		return { method: 'email' as TwoStepMethod, emailSent: true };
	}
};
