import { timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runDailyJob } from '$lib/server/modules/identity';
import type { RequestHandler } from './$types';

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

// Called once a day by the host's scheduler, with the secret in the
// Authorization header: `Authorization: Bearer <DAILY_JOB_SECRET>`.
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.DAILY_JOB_SECRET;
	const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';

	// With no secret set, the job can't be run at all.
	if (!secret || !sameSecret(given, secret)) error(401, { message: 'Not allowed' });

	return json(await runDailyJob());
};
