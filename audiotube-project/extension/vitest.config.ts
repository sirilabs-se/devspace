import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'manifest.config.test.ts'],
		exclude: ['_prototype/**', 'dist/**', 'tests/e2e/**', 'node_modules/**']
	}
});
