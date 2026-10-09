import { redirect, type Handle } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/modules/identity';
import { isPublicPath } from '$lib/server/public-paths';

export const handle: Handle = async ({ event, resolve }) => {
	// The only place the acting user is decided: from the session cookie.
	event.locals.user = await getSessionUser(event.request.headers, event.cookies);

	// Unknown addresses fall through to the normal "not found" page.
	if (!event.locals.user && event.route.id !== null && !isPublicPath(event.url.pathname)) {
		// Remember where they were going, so login can send them back.
		const next = event.url.pathname + event.url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	return resolve(event);
};
