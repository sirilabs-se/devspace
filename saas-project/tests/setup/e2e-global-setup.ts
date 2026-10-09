import pg from 'pg';
import { prepareTestDatabase } from './prepare-test-database';
import { testDatabaseUrl } from './test-env.js';

/**
 * Before the browser tests: make sure the test database exists and is up to
 * date, then empty it. Leftovers from an earlier run, such as attempt counters,
 * would otherwise trip the app's rate limits.
 */
export default async function setup() {
	const url = testDatabaseUrl(process.env);
	await prepareTestDatabase(url);

	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		const tables = await client.query<{ tablename: string }>(
			"select tablename from pg_tables where schemaname = 'public'"
		);
		const names = tables.rows.map((row) => `"${row.tablename}"`).join(', ');
		if (names) await client.query(`truncate table ${names} restart identity cascade`);
	} finally {
		await client.end();
	}
}
