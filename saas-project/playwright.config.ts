import { defineConfig, devices } from '@playwright/test';
import { testEnvironment } from './tests/setup/test-env.js';

const origin = 'http://localhost:4173';

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/setup/e2e-global-setup.ts',
	forbidOnly: !!process.env.CI,
	reporter: 'list',
	use: { baseURL: origin },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		env: testEnvironment(process.env, origin)
	}
});
