import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedInUser } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import {
	getContactDetails,
	getProfile,
	getPublicProfiles,
	timeZones,
	updateProfile
} from './profile';
import { getSessionUser } from './session';
import type { UserId } from './user-id';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let anna: UserId;
let bo: UserId;

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!.id;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!
		.id;
});

describe('getProfile and updateProfile', () => {
	it('starts with English and UTC', async () => {
		expect(await getProfile(anna)).toEqual({
			name: 'Anna Berg',
			username: null,
			image: null,
			locale: 'en',
			timeZone: 'UTC'
		});
	});

	it('changes the name, language and time zone', async () => {
		const result = await updateProfile(anna, {
			name: '  Anna Bergström ',
			locale: 'sv',
			timeZone: 'Europe/Stockholm'
		});

		expect(result).toEqual({ ok: true });
		expect(await getProfile(anna)).toMatchObject({
			name: 'Anna Bergström',
			locale: 'sv',
			timeZone: 'Europe/Stockholm'
		});
	});

	it('changes only the acting user’s profile, never anyone else’s', async () => {
		const before = await getProfile(bo);

		// Even when the form tries to name another person, only the acting user is touched.
		await updateProfile(anna, {
			name: 'Changed',
			locale: 'sv',
			timeZone: 'Europe/Stockholm',
			id: bo,
			userId: bo,
			email: 'bo@example.com'
		});

		expect(await getProfile(bo)).toEqual(before);
		expect((await getProfile(anna)).name).toBe('Changed');
	});

	it('refuses an empty or over-long name, an unknown language and an unknown time zone', async () => {
		const valid = { name: 'Anna', locale: 'en', timeZone: 'UTC' };

		expect(await updateProfile(anna, { ...valid, name: '  ' })).toEqual({
			ok: false,
			errors: { name: 'name_required' }
		});
		expect(await updateProfile(anna, { ...valid, name: 'a'.repeat(101) })).toEqual({
			ok: false,
			errors: { name: 'name_too_long' }
		});
		expect(await updateProfile(anna, { ...valid, locale: 'xx' })).toEqual({
			ok: false,
			errors: { locale: 'locale_invalid' }
		});
		expect(await updateProfile(anna, { ...valid, timeZone: 'Mars/Olympus' })).toEqual({
			ok: false,
			errors: { timeZone: 'time_zone_invalid' }
		});
		expect((await getProfile(anna)).name).toBe('Anna Berg');
	});

	it('knows Stockholm and UTC as time zones', () => {
		expect(timeZones()).toContain('Europe/Stockholm');
		expect(timeZones()[0]).toBe('UTC');
	});
});

describe('getPublicProfiles', () => {
	it('returns only the name, username and avatar', async () => {
		const profiles = await getPublicProfiles([anna, bo]);

		expect(profiles).toHaveLength(2);
		const annaProfile = profiles.find((profile) => profile.id === anna)!;
		expect(annaProfile).toEqual({ id: anna, name: 'Anna Berg', username: null, image: null });
		expect(JSON.stringify(profiles)).not.toMatch(/example\.com|locale|timeZone|UTC/);
	});

	it('leaves out unknown users and copes with an empty list', async () => {
		expect(await getPublicProfiles(['no-such-user' as UserId])).toEqual([]);
		expect(await getPublicProfiles([])).toEqual([]);
	});
});

describe('getContactDetails', () => {
	it('returns the email, name, language and time zone of one user', async () => {
		await updateProfile(anna, { name: 'Anna Berg', locale: 'sv', timeZone: 'Europe/Stockholm' });

		expect(await getContactDetails(anna)).toEqual({
			email: 'anna@example.com',
			name: 'Anna Berg',
			locale: 'sv',
			timeZone: 'Europe/Stockholm'
		});
		expect(await getContactDetails('no-such-user' as UserId)).toBeNull();
	});
});
