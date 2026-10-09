import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { checkUsernameAvailable } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

const query = z.object({ username: z.string().max(100) });

export const GET: RequestHandler = async ({ url }) => {
	const parsed = query.safeParse({ username: url.searchParams.get('username') });
	if (!parsed.success) error(400, { message: 'A username is required' });

	return json(await checkUsernameAvailable(parsed.data.username));
};
