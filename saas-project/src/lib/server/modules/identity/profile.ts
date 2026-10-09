import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { users } from './schema';
import type { UserId } from './user-id';

/** Languages a person can choose. Only English exists so far; the choice is stored for later. */
export const LOCALES = ['en', 'sv'] as const;
export type Locale = (typeof LOCALES)[number];

const NAME_MAX_LENGTH = 100;

/** Every time zone name the server knows, e.g. "Europe/Stockholm". */
export function timeZones(): string[] {
	return ['UTC', ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC')];
}

/** A person's own profile, as they see and edit it. */
export type Profile = {
	name: string;
	username: string | null;
	image: string | null;
	locale: string;
	timeZone: string;
};

/** Reads the acting user's own profile. */
export async function getProfile(userId: UserId): Promise<Profile> {
	const [profile] = await db
		.select({
			name: users.name,
			username: users.displayUsername,
			image: users.image,
			locale: users.locale,
			timeZone: users.timeZone
		})
		.from(users)
		.where(eq(users.id, userId));
	if (!profile) throw new Error('The acting user no longer exists');
	return profile;
}

export type ProfileField = 'name' | 'locale' | 'timeZone';
export type ProfileErrorCode =
	'name_required' | 'name_too_long' | 'locale_invalid' | 'time_zone_invalid';
export type UpdateProfileResult =
	{ ok: true } | { ok: false; errors: Partial<Record<ProfileField, ProfileErrorCode>> };

const profileSchema = z.object({
	name: z
		.string({ error: 'name_required' })
		.trim()
		.min(1, { error: 'name_required' })
		.max(NAME_MAX_LENGTH, { error: 'name_too_long' }),
	locale: z.enum(LOCALES, { error: 'locale_invalid' }),
	timeZone: z
		.string({ error: 'time_zone_invalid' })
		.refine((zone) => timeZones().includes(zone), { error: 'time_zone_invalid' })
});

/** Changes the acting user's own name, language and time zone. Nobody else's can be reached. */
export async function updateProfile(userId: UserId, input: unknown): Promise<UpdateProfileResult> {
	const parsed = profileSchema.safeParse(input);
	if (!parsed.success) {
		const errors: Partial<Record<ProfileField, ProfileErrorCode>> = {};
		for (const issue of parsed.error.issues) {
			errors[issue.path[0] as ProfileField] ??= issue.message as ProfileErrorCode;
		}
		return { ok: false, errors };
	}

	await db
		.update(users)
		.set({ name: parsed.data.name, locale: parsed.data.locale, timeZone: parsed.data.timeZone })
		.where(eq(users.id, userId));
	return { ok: true };
}

/** What anyone may see of a person: never their email or settings. */
export type PublicProfile = {
	id: UserId;
	name: string;
	username: string | null;
	image: string | null;
};

/** Returns the public profiles of these users. Unknown IDs are simply left out. */
export async function getPublicProfiles(userIds: UserId[]): Promise<PublicProfile[]> {
	if (userIds.length === 0) return [];
	const rows = await db
		.select({
			id: users.id,
			name: users.name,
			username: users.displayUsername,
			image: users.image
		})
		.from(users)
		.where(inArray(users.id, userIds));
	return rows.map((row) => ({ ...row, id: row.id as UserId }));
}

/** How to reach a person, for modules that send them notifications. */
export type ContactDetails = { email: string; name: string; locale: string; timeZone: string };

export async function getContactDetails(userId: UserId): Promise<ContactDetails | null> {
	const [contact] = await db
		.select({
			email: users.email,
			name: users.name,
			locale: users.locale,
			timeZone: users.timeZone
		})
		.from(users)
		.where(eq(users.id, userId));
	return contact ?? null;
}
