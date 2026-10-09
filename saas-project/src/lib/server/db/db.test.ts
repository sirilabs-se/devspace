import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from './index';

afterAll(async () => {
	await pool.end();
});

describe('database connection', () => {
	it('runs a query against the test database', async () => {
		const result = await db.execute(sql`select current_database() as name`);

		expect(result.rows[0].name).toMatch(/_test$/);
	});
});
