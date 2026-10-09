import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfile, getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser } from '../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { actions, load } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let anna: SessionUser;
let bo: SessionUser;

function event(user: SessionUser | null, fields: Record<string, string> = {}) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	return {
		request: new Request('http://localhost:5173/settings/profile', { method: 'POST', body }),
		locals: { user }
	} as never;
}

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;
});

describe('the profile page', () => {
	it('shows the signed-in person’s own profile and the choices available', async () => {
		const data = (await load(event(anna))) as {
			profile: { name: string };
			locales: string[];
			timeZones: string[];
		};

		expect(data.profile.name).toBe('Anna Berg');
		expect(data.locales).toEqual(['en', 'sv']);
		expect(data.timeZones).toContain('Europe/Stockholm');
	});

	it('saves the name, language and time zone, which are still there on the next visit', async () => {
		const result = await actions.save(
			event(anna, { name: 'Anna Bergström', locale: 'sv', timeZone: 'Europe/Stockholm' })
		);

		expect(result).toEqual({ saved: true });
		const data = (await load(event(anna))) as { profile: object };
		expect(data.profile).toMatchObject({
			name: 'Anna Bergström',
			locale: 'sv',
			timeZone: 'Europe/Stockholm'
		});
	});

	it('cannot change another person’s profile, whatever the form says', async () => {
		await actions.save(
			event(anna, {
				name: 'Hijacked',
				locale: 'en',
				timeZone: 'UTC',
				userId: bo.id,
				id: bo.id
			})
		);

		expect((await getProfile(bo.id)).name).toBe('Bo Lind');
		expect((await getProfile(anna.id)).name).toBe('Hijacked');
	});

	it('returns field errors for bad input', async () => {
		const result = await actions.save(event(anna, { name: '', locale: 'xx', timeZone: 'Nowhere' }));

		expect(result).toMatchObject({
			status: 400,
			data: {
				errors: { name: 'name_required', locale: 'locale_invalid', timeZone: 'time_zone_invalid' }
			}
		});
	});

	it('refuses someone who is not signed in', async () => {
		await expect(async () => load(event(null))).rejects.toMatchObject({ status: 401 });
		await expect(async () => actions.save(event(null))).rejects.toMatchObject({ status: 401 });
	});
});
