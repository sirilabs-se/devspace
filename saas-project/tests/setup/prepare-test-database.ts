import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Creates the test database if it is missing and applies every migration to it. */
export async function prepareTestDatabase(testUrl: string): Promise<void> {
	const databaseName = new URL(testUrl).pathname.slice(1);
	if (!/^[a-z0-9_]+_test$/.test(databaseName)) {
		throw new Error(`Refusing to prepare "${databaseName}": the name must end in _test`);
	}

	const adminUrl = new URL(testUrl);
	adminUrl.pathname = '/postgres';
	const admin = new pg.Client({ connectionString: adminUrl.toString() });
	await admin.connect();
	try {
		const existing = await admin.query('select 1 from pg_database where datname = $1', [
			databaseName
		]);
		if (existing.rowCount === 0) await admin.query(`create database "${databaseName}"`);
	} finally {
		await admin.end();
	}

	const pool = new pg.Pool({ connectionString: testUrl });
	try {
		await migrate(drizzle(pool), { migrationsFolder: './migrations' });
	} finally {
		await pool.end();
	}
}
