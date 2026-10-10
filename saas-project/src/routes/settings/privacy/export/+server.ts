import { error } from '@sveltejs/kit';
import { exportMyData, requireUser } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

// Downloads the signed-in person's own data as a file. Nobody else's can be asked for:
// there is nothing in the address or the request that names a person.
export const GET: RequestHandler = async ({ locals, request, getClientAddress }) => {
	const user = requireUser(locals);

	const result = await exportMyData(user, {
		ipAddress: getClientAddress(),
		userAgent: request.headers.get('user-agent')
	});
	if (result.status === 'rate_limited') {
		error(429, {
			message: 'You’ve downloaded your data several times. Please try again in an hour.'
		});
	}

	const today = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(result.data, null, 2) + '\n', {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="my-data-${today}.json"`,
			'cache-control': 'no-store'
		}
	});
};
