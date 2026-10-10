import { handleAuthRequest } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

// Where Google and Facebook send people back after they sign in there.
export const GET: RequestHandler = ({ request, getClientAddress }) =>
	handleAuthRequest(request, getClientAddress());
export const POST: RequestHandler = ({ request, getClientAddress }) =>
	handleAuthRequest(request, getClientAddress());
