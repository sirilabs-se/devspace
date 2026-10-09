import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const DEFAULT_DATABASE_URL = 'postgres://saas:saas@localhost:5432/saas';

/**
 * The database the logic tests run against: TEST_DATABASE_URL if set,
 * otherwise the development database's name with "_test" added.
 */
function testDatabaseUrl(env: Record<string, string | undefined>): string {
	if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;

	const url = new URL(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
	url.pathname = `${url.pathname}_test`;
	return url.toString();
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const testUrl = testDatabaseUrl(env);

	// Logic tests never touch the development database. Values already in the
	// environment win over .env, so this is what $env/dynamic/private returns.
	if (process.env.VITEST) process.env.DATABASE_URL = testUrl;

	return {
		plugins: [sveltekit()],
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node',
			globalSetup: ['./tests/setup/global-setup.ts'],
			env: { DATABASE_URL: testUrl }
		}
	};
});
