import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	// Each module keeps its own tables in a schema.ts inside its folder.
	schema: './src/lib/server/modules/*/schema.ts',
	out: './migrations',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'postgres://saas:saas@localhost:5432/saas'
	}
});
