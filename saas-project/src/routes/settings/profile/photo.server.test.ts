import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfile, getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser } from '../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { GET } from '../../files/avatars/[file]/+server';
import { actions } from './+page.server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);

let anna: SessionUser;

function upload(user: SessionUser | null, file?: File) {
	const body = new FormData();
	if (file) body.set('photo', file);
	return actions.photo({
		request: new Request('http://localhost:5173/settings/profile?/photo', { method: 'POST', body }),
		locals: { user }
	} as never);
}

const serve = (file: string) => GET({ params: { file } } as never);

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
});

describe('uploading a profile picture', () => {
	it('saves the picture, which can then be fetched', async () => {
		const result = await upload(anna, new File([png], 'me.png', { type: 'image/png' }));

		expect(result).toEqual({ photoSaved: true });
		const image = (await getProfile(anna.id)).image!;

		const response = await serve(image.split('/').pop()!);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
	});

	it('explains a missing file, a wrong type and a file that is too large', async () => {
		const text = new File(['not a picture'], 'me.png', { type: 'image/png' });
		const huge = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

		expect(await upload(anna)).toMatchObject({ status: 400, data: { photoError: 'empty' } });
		expect(await upload(anna, text)).toMatchObject({
			status: 400,
			data: { photoError: 'wrong_type' }
		});
		expect(await upload(anna, huge)).toMatchObject({
			status: 400,
			data: { photoError: 'too_large' }
		});
		expect((await getProfile(anna.id)).image).toBeNull();
	});

	it('removes the picture, after which it can no longer be fetched', async () => {
		await upload(anna, new File([png], 'me.png', { type: 'image/png' }));
		const name = (await getProfile(anna.id)).image!.split('/').pop()!;

		const result = await actions.removePhoto({ locals: { user: anna } } as never);

		expect(result).toEqual({ photoRemoved: true });
		expect((await getProfile(anna.id)).image).toBeNull();
		await expect(serve(name)).rejects.toMatchObject({ status: 404 });
	});

	it('refuses someone who is not signed in', async () => {
		await expect(async () => upload(null)).rejects.toMatchObject({ status: 401 });
		await expect(async () =>
			actions.removePhoto({ locals: { user: null } } as never)
		).rejects.toMatchObject({
			status: 401
		});
	});
});

describe('GET /files/avatars/[file]', () => {
	it('answers 404 for unknown and unsafe names', async () => {
		for (const name of ['00000000-0000-0000-0000-000000000000.png', '..', 'a.svg']) {
			await expect(serve(name), name).rejects.toMatchObject({ status: 404 });
		}
	});
});
