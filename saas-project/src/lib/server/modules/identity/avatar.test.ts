import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedInUser } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { AVATAR_MAX_BYTES, readAvatar, removeAvatar, setAvatar } from './avatar';
import { getProfile, getPublicProfiles } from './profile';
import { getSessionUser } from './session';
import type { UserId } from './user-id';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const png = Uint8Array.from(
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
		'base64'
	)
);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const webp = Uint8Array.from(Buffer.from('RIFF\x1a\0\0\0WEBPVP8 ', 'latin1'));

const fileName = (image: string) => image.split('/').pop()!;

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

describe('setAvatar', () => {
	it('stores the picture and shows it on the profile, privately and publicly', async () => {
		const result = await setAvatar(anna, png);

		expect(result).toMatchObject({ ok: true });
		const image = (result as { image: string }).image;
		expect(image).toMatch(/^\/files\/avatars\/[0-9a-f-]{36}\.png$/);
		expect((await getProfile(anna)).image).toBe(image);
		expect((await getPublicProfiles([anna]))[0].image).toBe(image);

		expect(await readAvatar(fileName(image))).toEqual({
			bytes: Buffer.from(png),
			contentType: 'image/png'
		});
	});

	it('accepts JPEG, PNG and WebP, judged by what the file really is', async () => {
		for (const [bytes, extension] of [
			[jpeg, 'jpg'],
			[png, 'png'],
			[webp, 'webp']
		] as const) {
			const result = await setAvatar(anna, bytes);
			expect(result.ok && result.image.endsWith(`.${extension}`)).toBe(true);
		}
	});

	it('refuses a file that is not a picture, whatever it is called', async () => {
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
		const text = new TextEncoder().encode('just some text pretending to be a png');

		expect(await setAvatar(anna, svg)).toEqual({ ok: false, error: 'wrong_type' });
		expect(await setAvatar(anna, text)).toEqual({ ok: false, error: 'wrong_type' });
		expect((await getProfile(anna)).image).toBeNull();
	});

	it('refuses an empty file and one over 2 MB', async () => {
		const tooLarge = new Uint8Array(AVATAR_MAX_BYTES + 1);
		tooLarge.set(png);

		expect(await setAvatar(anna, new Uint8Array())).toEqual({ ok: false, error: 'empty' });
		expect(await setAvatar(anna, tooLarge)).toEqual({ ok: false, error: 'too_large' });
		expect((await getProfile(anna)).image).toBeNull();
	});

	it('deletes the old file when a picture is replaced', async () => {
		const first = (await setAvatar(anna, png)) as { image: string };
		const second = (await setAvatar(anna, jpeg)) as { image: string };

		expect(await readAvatar(fileName(first.image))).toBeNull();
		expect(await readAvatar(fileName(second.image))).not.toBeNull();
	});

	it('touches only the acting user’s picture', async () => {
		const boImage = ((await setAvatar(bo, png)) as { image: string }).image;

		await setAvatar(anna, jpeg);
		await removeAvatar(anna);

		expect((await getProfile(bo)).image).toBe(boImage);
		expect(await readAvatar(fileName(boImage))).not.toBeNull();
	});
});

describe('removeAvatar', () => {
	it('clears the picture and deletes the stored file', async () => {
		const { image } = (await setAvatar(anna, png)) as { image: string };

		await removeAvatar(anna);

		expect((await getProfile(anna)).image).toBeNull();
		expect(await readAvatar(fileName(image))).toBeNull();
	});

	it('is fine when there is no picture', async () => {
		await expect(removeAvatar(anna)).resolves.toBeUndefined();
	});
});

describe('readAvatar', () => {
	it('returns nothing for unknown or unsafe file names', async () => {
		for (const name of ['nope.png', '../../etc/passwd', '..%2Fsecret', 'a.svg', '']) {
			expect(await readAvatar(name), name).toBeNull();
		}
	});
});
