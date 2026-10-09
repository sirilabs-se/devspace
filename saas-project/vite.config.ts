import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { testEnvironment } from './tests/setup/test-env.js';

export default defineConfig(({ mode }) => {
	const testEnv = testEnvironment(loadEnv(mode, process.cwd(), ''), 'http://localhost:5173');

	// Values already in the environment win over .env, so under test this is
	// what $env/dynamic/private returns.
	if (process.env.VITEST) Object.assign(process.env, testEnv);

	return {
		plugins: [sveltekit()],
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node',
			globalSetup: ['./tests/setup/global-setup.ts'],
			// Test files share one database, so they run one after another.
			fileParallelism: false,
			env: testEnv
		}
	};
});
