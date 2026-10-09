import { error } from '@sveltejs/kit';
import { readAvatar } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

// Serves profile pictures. They are public, and each has a random name that
// never changes its content, so browsers may keep them for a long time.
export const GET: RequestHandler = async ({ params }) => {
	const avatar = await readAvatar(params.file);
	if (!avatar) error(404, { message: 'Not found' });

	return new Response(avatar.bytes as BodyInit, {
		headers: {
			'content-type': avatar.contentType,
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
};
