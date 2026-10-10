import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { vi } from 'vitest';
import { db } from '$lib/server/db';
import { sendEmail } from '$lib/server/email';
import { signUp, verifyEmail, type CookieJar } from '$lib/server/modules/identity';

// Helpers for tests that need accounts. The test file must mock '$lib/server/email'.

export const testContext = { ipAddress: '203.0.113.5', userAgent: 'Test Browser' };

/** Collects cookies the way SvelteKit's `event.cookies` does, and plays them back as a header. */
export class TestCookieJar implements CookieJar {
	private values = new Map<string, string>();
	/** The options each cookie was last set with, e.g. how long it lasts. */
	readonly options = new Map<string, { maxAge?: number; httpOnly?: boolean }>();

	set(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean } = {}): void {
		this.options.set(name, options);
		// An empty value with no lifetime is how a cookie is removed.
		if (value === '' || options.maxAge === 0) this.values.delete(name);
		else this.values.set(name, encodeURIComponent(value));
	}

	/** SvelteKit's own cookies object has these too; the pages use them. */
	get(name: string): string | undefined {
		const value = this.values.get(name);
		return value === undefined ? undefined : decodeURIComponent(value);
	}

	delete(name: string): void {
		this.values.delete(name);
	}

	get size(): number {
		return this.values.size;
	}

	header(): string {
		return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ');
	}

	headers(): Headers {
		return new Headers(this.size > 0 ? { cookie: this.header() } : {});
	}
}

/** The link token from the most recent verification email sent to this address. */
export function verificationTokenFor(email: string): string {
	const sent = vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter((message) => message.to === email && message.text.includes('/verify-email?token='));
	const match = sent.at(-1)?.text.match(/verify-email\?token=(\S+)/);
	if (!match) throw new Error(`No verification email was sent to ${email}`);
	return decodeURIComponent(match[1]);
}

/**
 * A verification link token that expired a minute ago, signed the way the app
 * signs them. Built by hand so tests outside Identity don't need the login library.
 */
export function expiredVerificationTokenFor(email: string): string {
	return signedVerificationToken(email, -60);
}

function signedVerificationToken(email: string, secondsUntilExpiry: number): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const payload = { email, iat: now - 120, exp: now + secondsUntilExpiry };
	const body = `${encode({ alg: 'HS256' })}.${encode(payload)}`;
	const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? '')
		.update(body)
		.digest('base64url');
	return `${body}.${signature}`;
}

/** The token from the most recent "your email was changed" notice sent to this address. */
export function undoTokenFor(email: string): string {
	const sent = vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter(
			(message) => message.to === email && message.text.includes('/undo-email-change?token=')
		);
	const match = sent.at(-1)?.text.match(/undo-email-change\?token=(\S+)/);
	if (!match) throw new Error(`No change-of-email notice was sent to ${email}`);
	return match[1];
}

/** The token from the most recent password reset email sent to this address. */
export function resetTokenFor(email: string): string {
	const sent = vi
		.mocked(sendEmail)
		.mock.calls.map(([message]) => message)
		.filter((message) => message.to === email && message.text.includes('/reset-password?token='));
	const match = sent.at(-1)?.text.match(/reset-password\?token=(\S+)/);
	if (!match) throw new Error(`No password reset email was sent to ${email}`);
	return decodeURIComponent(match[1]);
}

/** A valid verification link token for this address, signed the way the app signs them. */
export function validVerificationTokenFor(email: string): string {
	return signedVerificationToken(email, 3600);
}

export async function createUnverifiedUser(email: string, name = 'Test Person'): Promise<void> {
	const result = await signUp(
		{ name, email, password: 'Correct-Horse-42', acceptTerms: true },
		testContext
	);
	if (!result.ok) throw new Error(`Sign-up failed: ${JSON.stringify(result)}`);
}

/** Signs up, opens the verification link, and returns the signed-in person's cookies. */
export async function createSignedInUser(
	email: string,
	name = 'Test Person'
): Promise<TestCookieJar> {
	await createUnverifiedUser(email, name);
	const jar = new TestCookieJar();
	const result = await verifyEmail(verificationTokenFor(email), jar, testContext);
	if (result.status !== 'verified') throw new Error(`Verification failed: ${result.status}`);
	return jar;
}

/** Gives an account the admin role, the way the command-line script does. */
export async function makeAdmin(email: string): Promise<void> {
	await db.execute(sql`update users set role = 'admin' where email = ${email}`);
}
