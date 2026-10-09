import { fail, redirect } from '@sveltejs/kit';
import { resendVerificationEmail, verifyEmail } from '$lib/server/modules/identity';
import { forgetPendingEmail, pendingEmail } from '$lib/server/pending-email';
import type { Actions, PageServerLoad } from './$types';

/**
 * Which of the screen's states to show:
 * - "required": check your inbox
 * - "verified": the email is confirmed and the person is signed in
 * - "expired" / "invalid": the link can't be used
 */
export const load: PageServerLoad = async ({ url, cookies, locals, request, getClientAddress }) => {
	const token = url.searchParams.get('token');

	if (token !== null) {
		const result = await verifyEmail(token, cookies, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'verified') {
			forgetPendingEmail(cookies);
			// Drop the used link from the address bar, so reloading doesn't show "link already used".
			redirect(303, '/verify-email?done');
		}
		return { state: result.status, email: pendingEmail(cookies) };
	}

	if (url.searchParams.has('done') && locals.user?.emailVerified) {
		return { state: 'verified' as const, email: locals.user.email };
	}

	return { state: 'required' as const, email: pendingEmail(cookies) };
};

export const actions: Actions = {
	resend: async ({ request, cookies, getClientAddress }) => {
		const form = await request.formData();
		const typed = form.get('email');
		// The expired-link screen asks for the address; the inbox screen remembers it.
		const email = typeof typed === 'string' && typed.trim() !== '' ? typed : pendingEmail(cookies);

		const result = await resendVerificationEmail(email, {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'throttled') {
			return fail(429, { throttled: true as const, retryAfterSeconds: result.retryAfterSeconds });
		}
		if (result.status === 'invalid_email') {
			return fail(400, { emailError: 'email_invalid' as const });
		}
		return { resent: true as const };
	}
};
