import { fail } from '@sveltejs/kit';
import { canUndoEmailChange, undoEmailChange } from '$lib/server/modules/identity';
import type { Actions, PageServerLoad } from './$types';

// Reached from the notice sent to the old address after a change of email.
// Opening the link only shows a confirmation; the undo happens on the button press.
export const load: PageServerLoad = async ({ url }) => {
	return { usable: await canUndoEmailChange(url.searchParams.get('token')) };
};

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		const result = await undoEmailChange(url.searchParams.get('token'), {
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent')
		});

		if (result.status === 'undone') return { undone: true as const };
		return fail(400, { problem: result.status });
	}
};
