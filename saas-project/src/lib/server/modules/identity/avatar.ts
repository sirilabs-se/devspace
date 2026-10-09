import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { deleteFile, readFile, saveFile } from '$lib/server/storage';
import { users } from './schema';
import type { UserId } from './user-id';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const URL_PREFIX = '/files/';
const AVATAR_KEY = /^avatars\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Works out the picture's real type from its first bytes, whatever the upload claims to be. */
function imageExtension(bytes: Uint8Array): keyof typeof CONTENT_TYPES | null {
	const starts = (...signature: number[]) =>
		signature.every((byte, index) => bytes[index] === byte);
	const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

	if (starts(0xff, 0xd8, 0xff)) return 'jpg';
	if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
	if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
	return null;
}

const keyFromUrl = (url: string | null) =>
	url?.startsWith(URL_PREFIX) && AVATAR_KEY.test(url.slice(URL_PREFIX.length))
		? url.slice(URL_PREFIX.length)
		: null;

export type SetAvatarResult =
	{ ok: true; image: string } | { ok: false; error: 'empty' | 'too_large' | 'wrong_type' };

/** Stores a new profile picture for the acting user, replacing any old one. */
export async function setAvatar(userId: UserId, bytes: Uint8Array): Promise<SetAvatarResult> {
	if (bytes.length === 0) return { ok: false, error: 'empty' };
	if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, error: 'too_large' };
	const extension = imageExtension(bytes);
	if (!extension) return { ok: false, error: 'wrong_type' };

	const [user] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
	if (!user) throw new Error('The acting user no longer exists');

	// A fresh random name each time, so an old picture is never shown from a browser's cache.
	const key = `avatars/${randomUUID()}.${extension}`;
	await saveFile(key, bytes);
	const image = `${URL_PREFIX}${key}`;
	await db.update(users).set({ image }).where(eq(users.id, userId));

	const oldKey = keyFromUrl(user.image);
	if (oldKey) await deleteFile(oldKey);
	return { ok: true, image };
}

/** Removes the acting user's profile picture and deletes the stored file. */
export async function removeAvatar(userId: UserId): Promise<void> {
	const [user] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
	if (!user) throw new Error('The acting user no longer exists');

	await db.update(users).set({ image: null }).where(eq(users.id, userId));
	const key = keyFromUrl(user.image);
	if (key) await deleteFile(key);
}

/** Reads a stored profile picture by its file name, for serving. Profile pictures are public. */
export async function readAvatar(
	fileName: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	const key = `avatars/${fileName}`;
	if (!AVATAR_KEY.test(key)) return null;

	const bytes = await readFile(key);
	if (!bytes) return null;
	const extension = key.split('.').pop() as keyof typeof CONTENT_TYPES;
	return { bytes, contentType: CONTENT_TYPES[extension] };
}
