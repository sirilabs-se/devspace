// Settings shared by the logic tests (Vitest) and the browser tests (Playwright).
// Both run against their own database, never the development one.

import os from 'node:os';
import path from 'node:path';

const DEFAULT_DATABASE_URL = 'postgres://saas:saas@localhost:5432/saas';

/**
 * The test database: TEST_DATABASE_URL if set, otherwise the development
 * database's name with "_test" added.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function testDatabaseUrl(env) {
	if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;

	const url = new URL(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
	url.pathname = `${url.pathname}_test`;
	return url.toString();
}

/**
 * Environment variables the app needs while under test. None of these are real secrets.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} origin
 * @returns {Record<string, string>}
 */
export function testEnvironment(env, origin) {
	return {
		DATABASE_URL: testDatabaseUrl(env),
		ORIGIN: origin,
		BETTER_AUTH_SECRET: 'test-only-secret-not-used-anywhere-else',
		DAILY_JOB_SECRET: 'test-only-daily-job-secret',
		EMAIL_TRANSPORT: 'console',
		// Made-up credentials, so the Google and Facebook buttons appear under test.
		GOOGLE_CLIENT_ID: 'test-google-client',
		GOOGLE_CLIENT_SECRET: 'test-google-secret',
		FACEBOOK_CLIENT_ID: 'test-facebook-client',
		FACEBOOK_CLIENT_SECRET: 'test-facebook-secret',
		STORAGE_DRIVER: 'local',
		STORAGE_DIR: path.join(os.tmpdir(), 'saas-project-test-uploads')
	};
}
