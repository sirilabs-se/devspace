import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');

const videoVisibility = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.querySelector('video')!).visibility);
const flag = (page: Page) =>
	page.evaluate(() => document.documentElement.hasAttribute('data-audiotube-visible'));

async function openYouTube(context: BrowserContext) {
	const worker = await getWorker(context);
	// The early CSS has to be in place before the page is opened, as it is for a real user.
	await expect
		.poll(() =>
			worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length)
		)
		.toBe(1);
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.goto('https://www.youtube.com/watch?v=test1');
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	expect(await videoVisibility(page)).toBe('hidden');
	return { page, worker };
}

test('when the extension goes away the picture shows and stays visible', async ({ context }) => {
	const { page, worker } = await openYouTube(context);
	await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
	await expect(page.locator('audiotube-overlay')).toHaveCount(0, { timeout: 5000 });
	await expect.poll(() => videoVisibility(page)).toBe('visible');
	await page.waitForTimeout(500);
	expect(await videoVisibility(page)).toBe('visible');
	expect(await flag(page)).toBe(true);
});

test("a cut-off copy leaves a newer copy's flag alone", async ({ context }) => {
	const { page, worker } = await openYouTube(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect.poll(() => videoVisibility(page)).toBe('visible');

	// Stands in for a newer copy of the script: it has taken over the mark and set the flag.
	await page.evaluate(() =>
		document.documentElement.setAttribute('data-audiotube-owner', 'a-newer-copy')
	);
	await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
	await page.waitForTimeout(2500);
	expect(await flag(page)).toBe(true);
	expect(await videoVisibility(page)).toBe('visible');
	expect(
		await page.evaluate(() => document.documentElement.getAttribute('data-audiotube-owner'))
	).toBe('a-newer-copy');
});
