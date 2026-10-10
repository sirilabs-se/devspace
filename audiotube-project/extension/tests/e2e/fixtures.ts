import { chromium, test as base, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

export const DIST = path.resolve('dist');

/** The extension's service worker, once its extension APIs can be used. */
export async function getWorker(context: BrowserContext): Promise<Worker> {
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
	for (let attempt = 0; attempt < 50; attempt++) {
		const ready = await worker
			.evaluate(() => !!globalThis.chrome?.runtime?.id && !!globalThis.chrome?.storage?.local)
			.catch(() => false);
		if (ready) return worker;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return worker;
}

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
	// eslint-disable-next-line no-empty-pattern
	context: async ({}, use) => {
		const context = await chromium.launchPersistentContext('', {
			channel: 'chromium',
			args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
		});
		await use(context);
		await context.close();
	},
	extensionId: async ({ context }, use) => {
		const worker = await getWorker(context);
		await use(new URL(worker.url()).host);
	}
});

export { expect } from '@playwright/test';
