import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { createSignedInUser, testContext } from '../../../../../tests/setup/accounts';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { signInMethodCount } from './connections';
import { listPasskeys, removePasskey, renamePasskey } from './passkeys';
import { accounts, auditEvents, passkeys } from './schema';
import { getSessionUser, type SessionUser } from './session';
import { handleAuthRequest } from './social';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

let anna: SessionUser;
let bo: SessionUser;

/** A passkey row as the login library stores one after a device has registered it. */
async function givePasskey(user: SessionUser, id: string, name: string | null = null) {
	await db.insert(passkeys).values({
		id,
		userId: user.id,
		name,
		publicKey: 'public-key-bytes',
		credentialID: `credential-${id}`,
		counter: 0,
		deviceType: 'multiDevice',
		backedUp: true
	});
}

beforeEach(async () => {
	await resetDatabase();
	anna = (await getSessionUser(
		(await createSignedInUser('anna@example.com', 'Anna Berg')).headers()
	))!;
	bo = (await getSessionUser((await createSignedInUser('bo@example.com', 'Bo Lind')).headers()))!;
});

describe('listPasskeys', () => {
	it('lists only the acting user’s passkeys', async () => {
		await givePasskey(anna, 'a1', 'My laptop');
		await givePasskey(bo, 'b1', 'Bo’s phone');

		const list = await listPasskeys(anna.id);

		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: 'a1', name: 'My laptop', syncedAcrossDevices: true });
		expect(list[0].createdAt).toBeInstanceOf(Date);
		expect(JSON.stringify(list)).not.toContain('public-key-bytes');
	});
});

describe('renamePasskey', () => {
	it('renames the person’s own passkey', async () => {
		await givePasskey(anna, 'a1');

		expect(await renamePasskey(anna.id, 'a1', '  Work laptop ')).toEqual({ status: 'renamed' });
		expect((await listPasskeys(anna.id))[0].name).toBe('Work laptop');
	});

	it('refuses an empty or over-long name', async () => {
		await givePasskey(anna, 'a1', 'Before');

		expect(await renamePasskey(anna.id, 'a1', '   ')).toEqual({ status: 'name_invalid' });
		expect(await renamePasskey(anna.id, 'a1', 'x'.repeat(61))).toEqual({ status: 'name_invalid' });
		expect((await listPasskeys(anna.id))[0].name).toBe('Before');
	});

	it('cannot rename another person’s passkey', async () => {
		await givePasskey(bo, 'b1', 'Bo’s phone');

		expect(await renamePasskey(anna.id, 'b1', 'Hijacked')).toEqual({ status: 'not_found' });
		expect((await listPasskeys(bo.id))[0].name).toBe('Bo’s phone');
	});
});

describe('removePasskey', () => {
	it('removes a passkey when another way to sign in remains, and records it', async () => {
		await givePasskey(anna, 'a1');

		expect(await removePasskey(anna.id, 'a1', testContext)).toEqual({ status: 'removed' });

		expect(await listPasskeys(anna.id)).toHaveLength(0);
		const events = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'passkey_removed'));
		expect(events).toHaveLength(1);
		expect(events[0].subjectUserId).toBe(anna.id);
	});

	it('refuses to remove the last way to sign in', async () => {
		await givePasskey(anna, 'a1');
		// Someone left with a passkey and nothing else.
		await db.delete(accounts).where(eq(accounts.userId, anna.id));

		expect(await signInMethodCount(anna.id)).toBe(1);
		expect(await removePasskey(anna.id, 'a1', testContext)).toEqual({ status: 'last_method' });
		expect(await listPasskeys(anna.id)).toHaveLength(1);
	});

	it('allows removing one of two passkeys even with no password', async () => {
		await givePasskey(anna, 'a1');
		await givePasskey(anna, 'a2');
		await db.delete(accounts).where(eq(accounts.userId, anna.id));

		expect(await removePasskey(anna.id, 'a1', testContext)).toEqual({ status: 'removed' });
		expect(await removePasskey(anna.id, 'a2', testContext)).toEqual({ status: 'last_method' });
	});

	it('cannot remove another person’s passkey', async () => {
		await givePasskey(bo, 'b1');

		expect(await removePasskey(anna.id, 'b1', testContext)).toEqual({ status: 'not_found' });
		expect(await removePasskey(anna.id, null, testContext)).toEqual({ status: 'not_found' });
		expect(await listPasskeys(bo.id)).toHaveLength(1);
	});
});

describe('the passkey exchange addresses', () => {
	it('lets anyone ask to start a passkey sign-in', async () => {
		const response = await handleAuthRequest(
			new Request('http://localhost:5173/api/auth/passkey/generate-authenticate-options')
		);

		expect(response.status).toBe(200);
		const options = await response.json();
		expect(options.challenge).toBeTruthy();
		expect(options.rpId).toBe('localhost');
	});

	it('refuses to start adding a passkey for someone who is not signed in', async () => {
		const response = await handleAuthRequest(
			new Request('http://localhost:5173/api/auth/passkey/generate-register-options')
		);

		expect(response.status).toBe(401);
	});

	it('refuses a made-up passkey answer and starts no session', async () => {
		const response = await handleAuthRequest(
			new Request('http://localhost:5173/api/auth/passkey/verify-authentication', {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
				body: JSON.stringify({
					response: { id: 'nope', rawId: 'nope', type: 'public-key', response: {} }
				})
			})
		);

		expect(response.ok).toBe(false);
		expect(response.headers.get('set-cookie') ?? '').not.toContain('session_token');
	});

	it('keeps the other passkey addresses of the login library closed', async () => {
		for (const path of ['list-user-passkeys', 'delete-passkey', 'update-passkey']) {
			const response = await handleAuthRequest(
				new Request(`http://localhost:5173/api/auth/passkey/${path}`, { method: 'POST' })
			);
			expect(response.status, path).toBe(404);
		}
	});
});
