import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { appOrigin } from './auth';
import { describeDevice } from './device';
import { sendNewDeviceEmail } from './emails';
import type { RequestContext } from './request-context';
import { users } from './schema';
import type { CookieJar, SessionUser } from './session';

// Recognises a browser an account has been used on before, with a cookie kept
// on that browser. When an account turns up on a browser without its mark, the
// owner is emailed. Nothing about devices is stored on the server.

const COOKIE = 'known_devices';
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
// A browser remembers the accounts most recently used on it.
const MAX_ACCOUNTS_PER_BROWSER = 10;
// The first browser a brand-new account is used on is not "new": no alert is sent.
const NEW_ACCOUNT_MINUTES = 15;

export type CookieStore = CookieJar & { get(name: string): string | undefined };

/** The mark for one account. It can't be turned back into the account's ID. */
const markFor = (userId: string) => createHash('sha256').update(userId).digest('hex').slice(0, 24);

function signature(payload: string): string {
	if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
	return createHmac('sha256', env.BETTER_AUTH_SECRET)
		.update(`known-devices:${payload}`)
		.digest('base64url');
}

/** Reads the marks from the cookie. A cookie that was altered counts as no cookie. */
function readMarks(cookies: CookieStore): string[] {
	const [payload, given] = (cookies.get(COOKIE) ?? '').split('.');
	if (!payload || !given) return [];

	const expected = Buffer.from(signature(payload));
	const actual = Buffer.from(given);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return [];

	return payload.split('-').filter((mark) => /^[0-9a-f]{24}$/.test(mark));
}

function writeMarks(cookies: CookieStore, marks: string[]): void {
	const payload = marks.slice(-MAX_ACCOUNTS_PER_BROWSER).join('-');
	cookies.set(COOKIE, `${payload}.${signature(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: appOrigin().startsWith('https://'),
		maxAge: ONE_YEAR_IN_SECONDS
	});
}

export type DeviceRecognition = 'known' | 'first_device' | 'new_device';

/**
 * Called for each request from a signed-in person. On a browser the account
 * has been used on before, it does nothing. Otherwise it marks the browser,
 * and, unless the account is brand new, records the sign-in and emails the owner.
 */
export async function recogniseDevice(
	user: SessionUser,
	cookies: CookieStore,
	context: RequestContext,
	now: Date = new Date()
): Promise<DeviceRecognition> {
	const marks = readMarks(cookies);
	const mark = markFor(user.id);
	if (marks.includes(mark)) return 'known';

	writeMarks(cookies, [...marks.filter((other) => other !== mark), mark]);

	const [account] = await db
		.select({ createdAt: users.createdAt })
		.from(users)
		.where(eq(users.id, user.id));
	const ageMinutes = account ? (now.getTime() - account.createdAt.getTime()) / 60000 : 0;
	if (ageMinutes < NEW_ACCOUNT_MINUTES) return 'first_device';

	await recordAuditEvent(user.id, 'login_new_device', user.id, context);
	await sendNewDeviceEmail(user.email, {
		device: describeDevice(context.userAgent),
		ipAddress: context.ipAddress,
		at: now,
		origin: appOrigin()
	});
	return 'new_device';
}
