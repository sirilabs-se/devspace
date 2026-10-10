import { test } from '@playwright/test';
import pg from 'pg';
import { testDatabaseUrl } from '../setup/test-env.js';

export { expect, type Page } from '@playwright/test';

/**
 * The browser tests all come from one network address, so together they would
 * trip the app's limits per network address. Each test starts with those
 * counters cleared; the limits themselves are covered by the logic tests.
 */
async function clearAttemptCounters(): Promise<void> {
	const client = new pg.Client({ connectionString: testDatabaseUrl(process.env) });
	await client.connect();
	try {
		// Only the counters kept per network address. Those kept per email or per person stay,
		// because each test uses its own addresses and tests run side by side.
		await client.query("delete from rate_limits where key like '%-by-ip:%'");
	} finally {
		await client.end();
	}
}

// Applies to every test file that imports `test` from here.
test.beforeEach(clearAttemptCounters);

export { test };
