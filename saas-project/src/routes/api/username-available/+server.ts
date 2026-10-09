import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { checkUsernameAvailable, limitRequests } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

const query = z.object({ username: z.string().max(100) });

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
	const limit = await limitRequests('username-check-by-ip', getClientAddress());
	if (!limit.allowed) {
		return json(
			{ message: 'Too many checks. Try again shortly.' },
			{ status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } }
		);
	}

	const parsed = query.safeParse({ username: url.searchParams.get('username') });
	if (!parsed.success) error(400, { message: 'A username is required' });

	// A signed-in person's own name, and names held for them, count as available to them.
	return json(await checkUsernameAvailable(parsed.data.username, locals.user?.id ?? null));
};
