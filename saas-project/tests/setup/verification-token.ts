import { createHmac } from 'node:crypto';
import { testEnvironment } from './test-env.js';

/**
 * A working verification link token for the browser tests, which can't read
 * the app's emails. Signed with the test-only secret the app runs with under test.
 */
export function browserTestVerificationToken(email: string): string {
	const secret = testEnvironment(process.env, '').BETTER_AUTH_SECRET;
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = `${encode({ alg: 'HS256' })}.${encode({ email, iat: now, exp: now + 3600 })}`;
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
