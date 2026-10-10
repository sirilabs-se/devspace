import type { RequestContext } from './request-context';

/**
 * The headers handed to the login library for a request. It reads the cookies
 * from them, and records the device and network address on any session it
 * starts. The address always comes from the server's own knowledge of the
 * connection, never from a header the visitor sent.
 */
export function libraryHeaders(
	requestHeaders: Headers | undefined,
	context: RequestContext
): Headers {
	const headers = new Headers();
	const cookie = requestHeaders?.get('cookie');
	if (cookie) headers.set('cookie', cookie);
	if (context.userAgent) headers.set('user-agent', context.userAgent);
	if (context.ipAddress) headers.set('x-forwarded-for', context.ipAddress);
	return headers;
}
