import { error, redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { getSessionUser, recogniseDevice } from '$lib/server/modules/identity';
import { isPublicPath } from '$lib/server/public-paths';

/** The visitor's network address, or null where it can't be known (such as while pre-rendering). */
function clientAddress(event: RequestEvent): string | null {
	try {
		return event.getClientAddress();
	} catch {
		return null;
	}
}

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

const welcomeExempt = (pathname: string) =>
	pathname === '/welcome' ||
	pathname === '/logout' ||
	// An admin viewing the app as someone who hasn't accepted the terms can still leave.
	pathname === '/stop-impersonating' ||
	pathname.startsWith('/api/auth/') ||
	pathname.startsWith('/files/');

export const handle: Handle = async ({ event, resolve }) => {
	// The only place the acting user is decided: from the session cookie.
	event.locals.user = await getSessionUser(event.request.headers, event.cookies);

	// The first request from a browser this account hasn't been used on sends its owner an alert.
	if (event.locals.user) {
		await recogniseDevice(event.locals.user, event.cookies, {
			ipAddress: clientAddress(event),
			userAgent: event.request.headers.get('user-agent')
		});
	}

	// Unknown addresses fall through to the normal "not found" page.
	if (!event.locals.user && event.route.id !== null && !isPublicPath(event.url.pathname)) {
		// Remember where they were going, so login can send them back.
		const next = event.url.pathname + event.url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	// The admin area is for admins only. Each admin page and function checks again.
	if (isAdminPath(event.url.pathname) && event.locals.user?.role !== 'admin') {
		error(403, { message: 'You don’t have access to this area' });
	}

	// Someone who signed up through Google or Facebook must accept the terms first.
	if (
		event.locals.user?.welcomePending &&
		event.route.id !== null &&
		!welcomeExempt(event.url.pathname)
	) {
		redirect(303, '/welcome');
	}

	return resolve(event);
};
