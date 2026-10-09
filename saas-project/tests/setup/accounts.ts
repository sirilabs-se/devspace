import { createHmac } from 'node:crypto';
import { vi } from 'vitest';
import { sendEmail } from '$lib/server/email';
import { signUp, verifyEmail, type CookieJar } from '$lib/server/modules/identity';

// Helpers for tests that need accounts. The test file must mock '$lib/server/email'.

export const testContext = { ipAddress: '203.0.113.5', userAgent: 'Test Browser' };

/** Collects cookies the way SvelteKit's `event.cookies` does, and plays them back as a header. */
export class TestCookieJar implements CookieJar {
	private values = new Map<string, string>();

	set(name: string, value: string): void {
		this.values.set(name, encodeURIComponent(value));
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
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = `${encode({ alg: 'HS256' })}.${encode({ email, iat: now - 120, exp: now - 60 })}`;
	const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? '')
		.update(body)
		.digest('base64url');
	return `${body}.${signature}`;
}

export async function createUnverifiedUser(email: string, name = 'Test Person'): Promise<void> {
	const result = await signUp(
		{ name, email, password: 'Correct-Horse-42', acceptTerms: true },
		testContext
	);
	if (!result.ok) throw new Error(`Sign-up failed: ${JSON.stringify(result.errors)}`);
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
