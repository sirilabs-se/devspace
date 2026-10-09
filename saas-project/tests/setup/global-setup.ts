import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

/** Creates the test database if it is missing and applies every migration to it. */
export default async function setup(project: TestProject) {
	const testUrl = project.config.env.DATABASE_URL;
	if (!testUrl) throw new Error('The test DATABASE_URL is not set');

	const databaseName = new URL(testUrl).pathname.slice(1);
	if (!/^[a-z0-9_]+$/.test(databaseName)) {
		throw new Error(`Unexpected test database name: ${databaseName}`);
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
