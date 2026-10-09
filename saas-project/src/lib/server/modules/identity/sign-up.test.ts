import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { resetDatabase } from '../../../../../tests/setup/reset-database';
import { accounts, auditEvents, consents, users } from './schema';
import { signUp } from './sign-up';

vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn() }));

const context = { ipAddress: '203.0.113.5', userAgent: 'Test Browser' };
const valid = {
	name: 'Anna Berg',
	email: 'anna@example.com',
	password: 'Correct-Horse-42',
	username: 'Anna.Berg',
	acceptTerms: true
};

const sentEmails = () => vi.mocked(sendEmail).mock.calls.map(([email]) => email);

beforeEach(async () => {
	await resetDatabase();
	vi.mocked(sendEmail).mockClear();
});

describe('signUp', () => {
	it('creates the account and sends a verification email', async () => {
		const result = await signUp(valid, context);

		expect(result).toEqual({ ok: true });

		const [user] = await db.select().from(users);
		expect(user).toMatchObject({
			name: 'Anna Berg',
			email: 'anna@example.com',
			emailVerified: false,
			username: 'anna.berg',
			displayUsername: 'Anna.Berg',
			role: 'user'
		});

		expect(sentEmails()).toHaveLength(1);
		expect(sentEmails()[0].to).toBe('anna@example.com');
		expect(sentEmails()[0].text).toMatch(/http:\/\/localhost:5173\/verify-email\?token=\S+/);
	});

	it('stores the password only as a hash and starts no session', async () => {
		await signUp(valid, context);

		const [account] = await db.select().from(accounts);
		expect(account.providerId).toBe('credential');
		expect(account.password).toBeTruthy();
		expect(account.password).not.toContain(valid.password);
	});

	it('saves the consent records and an audit entry', async () => {
		await signUp(valid, context);

		const [user] = await db.select().from(users);
		const saved = await db.select().from(consents).where(eq(consents.userId, user.id));
		expect(saved.map((consent) => consent.document).sort()).toEqual([
			'age_confirmation',
			'privacy',
			'terms'
		]);
		expect(saved.every((consent) => consent.version === '1')).toBe(true);

		const events = await db.select().from(auditEvents);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			action: 'signup',
			actorUserId: user.id,
			subjectUserId: user.id,
			ipAddress: '203.0.113.5',
			userAgent: 'Test Browser'
		});
		expect(JSON.stringify(events[0])).not.toContain(valid.password);
	});

	it('gives the same answer for an email that is already registered, and emails the owner', async () => {
		await signUp(valid, context);
		vi.mocked(sendEmail).mockClear();

		const result = await signUp(
			{ ...valid, email: 'ANNA@example.com', username: 'someone-else' },
			context
		);

		expect(result).toEqual({ ok: true });
		expect(await db.select().from(users)).toHaveLength(1);

		expect(sentEmails()).toHaveLength(1);
		expect(sentEmails()[0].to).toBe('anna@example.com');
		expect(sentEmails()[0].subject).toMatch(/already have/i);
		expect(sentEmails()[0].text).not.toContain('verify-email');

		const events = await db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.action, 'signup_existing_email'));
		expect(events).toHaveLength(1);
		expect(events[0].actorUserId).toBeNull();
	});

	it('creates an account with no username when none is given', async () => {
		for (const username of [undefined, '', '   ']) {
			await resetDatabase();
			const result = await signUp({ ...valid, username }, context);

			expect(result).toEqual({ ok: true });
			const [user] = await db.select().from(users);
			expect(user.username).toBeNull();
			expect(user.name).toBe('Anna Berg');
		}
	});

	it('requires a full name', async () => {
		const result = await signUp({ ...valid, name: '   ' }, context);

		expect(result).toEqual({ ok: false, errors: { name: 'name_required' } });
		expect(await db.select().from(users)).toHaveLength(0);
	});

	it('rejects a name over 100 characters', async () => {
		const result = await signUp({ ...valid, name: 'a'.repeat(101) }, context);

		expect(result).toEqual({ ok: false, errors: { name: 'name_too_long' } });
	});

	it('rejects a password missing any one part of the rule', async () => {
		for (const password of ['Abcde1!', 'abcdefg1!', 'ABCDEFG1!', 'Abcdefgh!', 'Abcdefgh1']) {
			const result = await signUp({ ...valid, password }, context);

			expect(result, password).toEqual({ ok: false, errors: { password: 'password_too_weak' } });
		}
		expect(await db.select().from(users)).toHaveLength(0);
		expect(sentEmails()).toHaveLength(0);
	});

	it('rejects an invalid email', async () => {
		const result = await signUp({ ...valid, email: 'not-an-email' }, context);

		expect(result).toEqual({ ok: false, errors: { email: 'email_invalid' } });
	});

	it('accepts a username with dots, but not one that starts or ends with a dot', async () => {
		expect(await signUp({ ...valid, username: '.maya' }, context)).toEqual({
			ok: false,
			errors: { username: 'username_invalid' }
		});
		expect(await signUp({ ...valid, username: 'maya.' }, context)).toEqual({
			ok: false,
			errors: { username: 'username_invalid' }
		});
		expect(await signUp({ ...valid, username: 'maya.okafor' }, context)).toEqual({ ok: true });
	});

	it('rejects a badly formed username', async () => {
		const result = await signUp({ ...valid, username: 'a b' }, context);

		expect(result).toEqual({ ok: false, errors: { username: 'username_invalid' } });
	});

	it('rejects a reserved username', async () => {
		const result = await signUp({ ...valid, username: 'Admin' }, context);

		expect(result).toEqual({ ok: false, errors: { username: 'username_reserved' } });
	});

	it('rejects a username that is taken, whatever the letter case', async () => {
		await signUp(valid, context);

		const result = await signUp(
			{ ...valid, email: 'other@example.com', username: 'ANNA.BERG' },
			context
		);

		expect(result).toEqual({ ok: false, errors: { username: 'username_taken' } });
		expect(await db.select().from(users)).toHaveLength(1);
	});

	it('requires the single checkbox for the terms, privacy policy and 18+', async () => {
		const result = await signUp({ ...valid, acceptTerms: false }, context);

		expect(result).toEqual({ ok: false, errors: { acceptTerms: 'terms_required' } });
		expect(await db.select().from(users)).toHaveLength(0);
	});

	it('reports every problem at once', async () => {
		const result = await signUp(
			{ name: '', email: '', password: '', username: 'a', acceptTerms: false },
			context
		);

		expect(result).toEqual({
			ok: false,
			errors: {
				name: 'name_required',
				email: 'email_invalid',
				password: 'password_too_weak',
				username: 'username_invalid',
				acceptTerms: 'terms_required'
			}
		});
	});

	it('copes with input that is not text', async () => {
		const result = await signUp({ ...valid, email: null, password: 12345 }, context);

		expect(result).toMatchObject({
			ok: false,
			errors: { email: 'email_invalid', password: 'password_too_weak' }
		});
	});
});
