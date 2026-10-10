import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser, type SessionUser } from '$lib/server/modules/identity';
import { createSignedInUser } from '../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../tests/setup/reset-database';
import { load } from './+page.server';
import { GET } from './export/+server';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let anna: SessionUser;
let bo: SessionUser;

function event(user: SessionUser | null, query = '') {
	const url = new URL(`http://localhost:5173/settings/privacy/export${query}`);
	return {
		url,
		locals: { user },
		request: new Request(url),
		getClientAddress: () => '203.0.113.5'
	} as never;
}

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;
});

describe('the privacy page', () => {
	it('lists what the signed-in person accepted', async () => {
		const data = (await load(event(anna))) as {
			timeZone: string;
			consents: { document: string; version: string; acceptedAt: string }[];
		};

		expect(data.consents.map((consent) => consent.document).sort()).toEqual([
			'age_confirmation',
			'privacy',
			'terms'
		]);
		expect(data.consents[0].acceptedAt).toMatch(/^\d{4}-/);
	});

	it('refuses someone who is not signed in', async () => {
		await expect(async () => load(event(null))).rejects.toMatchObject({ status: 401 });
	});
});

describe('GET /settings/privacy/export', () => {
	it('downloads the signed-in person’s data as a JSON file', async () => {
		const response = await GET(event(anna));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(response.headers.get('content-disposition')).toMatch(
			/^attachment; filename="my-data-\d{4}-\d{2}-\d{2}\.json"$/
		);
		const data = await response.json();
		expect(data.profile.email).toBe('anna@example.com');
		expect(Object.keys(data)).toEqual([
			'about',
			'exportedAt',
			'profile',
			'preferences',
			'signInMethods',
			'sessions',
			'consents',
			'usernamesOnHold',
			'securityEvents'
		]);
	});

	it('cannot be made to download another person’s data, whatever the address says', async () => {
		const response = await GET(event(anna, `?userId=${bo.id}&email=bo@example.com&id=${bo.id}`));
		const text = await response.text();

		expect(JSON.parse(text).profile.email).toBe('anna@example.com');
		expect(text).not.toContain('bo@example.com');
		expect(text).not.toContain(bo.id);
	});

	it('refuses someone who is not signed in', async () => {
		await expect(async () => GET(event(null))).rejects.toMatchObject({ status: 401 });
	});
});
