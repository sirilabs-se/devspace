import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

/** Empties every table in the test database, so each test starts clean. */
export async function resetDatabase(): Promise<void> {
	const database = await db.execute<{ name: string }>(sql`select current_database() as name`);
	if (!database.rows[0].name.endsWith('_test')) {
		throw new Error('resetDatabase may only run against a test database');
	}

	const tables = await db.execute<{ tablename: string }>(
		sql`select tablename from pg_tables where schemaname = 'public'`
	);
	if (tables.rows.length === 0) return;

	const names = tables.rows.map((row) => `"${row.tablename}"`).join(', ');
	await db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
}
