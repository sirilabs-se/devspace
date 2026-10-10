import { getProfile, listConsents, requireUser } from '$lib/server/modules/identity';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);

	return {
		timeZone: (await getProfile(user.id)).timeZone,
		consents: (await listConsents(user.id)).map((consent) => ({
			...consent,
			acceptedAt: consent.acceptedAt.toISOString()
		}))
	};
};
