import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const overlay = (page: Page) => page.locator('audiotube-overlay');
const control = (page: Page) => page.locator('audiotube-control');

async function openYouTube(context: BrowserContext, init?: () => void) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	if (init) await page.addInitScript(init);
	await page.goto('https://www.youtube.com/watch?v=test1');
	return page;
}

test('a copy left by an older version is removed, so there is exactly one overlay', async ({
	context
}) => {
	const page = await openYouTube(context, () => {
		document.addEventListener('DOMContentLoaded', () => {
			for (const tag of ['audiotube-overlay', 'audiotube-control']) {
				const stale = document.createElement(tag);
				stale.dataset.stale = 'true';
				document.body.append(stale);
			}
		});
	});
	await expect(overlay(page)).toHaveCount(1);
	await expect(control(page)).toHaveCount(0);
	expect(await page.locator('[data-stale]').count()).toBe(0);
});

test('a copy cut off from the extension takes its overlay away', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);
	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
	await expect(overlay(page)).toHaveCount(0, { timeout: 5000 });
});

async function failEveryWrite(context: BrowserContext) {
	const worker = await getWorker(context);
	await worker.evaluate(() => {
		chrome.storage.local.set = () => Promise.reject(new Error('Storage is not available'));
	});
}

test('when Show video cannot be saved the overlay stays and says so', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);
	await failEveryWrite(context);

	await overlay(page).getByRole('button', { name: 'Show video' }).click();
	await expect(overlay(page).getByRole('alert')).toHaveText(
		"Couldn't change the setting. Try again."
	);
	await expect(overlay(page)).toHaveCount(1);
});

test('when the control bar button cannot be saved it says so and stays', async ({ context }) => {
	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const page = await openYouTube(context);
	await expect(control(page)).toHaveCount(1);
	await failEveryWrite(context);

	await control(page).getByRole('button', { name: 'Audio only' }).click();
	await expect(control(page).getByRole('alert')).toHaveText(
		"Couldn't change the setting. Try again."
	);
	await expect(control(page)).toHaveCount(1);
	await expect(overlay(page)).toHaveCount(0);
});
