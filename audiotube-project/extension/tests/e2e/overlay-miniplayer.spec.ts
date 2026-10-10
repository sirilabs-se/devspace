import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
type Win = { [K in '__miniplayer' | '__expand' | '__closeMini' | '__hideMini']: () => void };

const overlay = (page: Page) => page.locator('audiotube-overlay');
const run = (page: Page, name: keyof Win) =>
	page.evaluate((n) => (window as unknown as Win)[n](), name);

async function openYouTube(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.goto('https://www.youtube.com/watch?v=test1');
	await expect(overlay(page)).toHaveCount(1);
	return page;
}

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

test('the mini-player is covered while audio-only is on, and uncovered when it turns off', async ({
	context
}) => {
	const page = await openYouTube(context);
	await run(page, '__miniplayer');
	expect(await page.evaluate(() => location.pathname)).toBe('/');
	await expect(overlay(page)).toHaveCount(1);
	expect(
		await page.evaluate(
			() => !!document.querySelector('ytd-miniplayer #movie_player > audiotube-overlay')
		)
	).toBe(true);
	expect(JSON.stringify(await box(page, 'audiotube-overlay'))).toBe(
		JSON.stringify(await box(page, '#movie_player'))
	);
	expect((await box(page, '#movie_player')).width).toBe(400);

	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect(overlay(page)).toHaveCount(0);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: true }));
	await expect(overlay(page)).toHaveCount(1);
});

test('the mini-player cover is the compact one', async ({ context }) => {
	const page = await openYouTube(context);
	const labelWide = await overlay(page).getByText('Audio only').isVisible();
	expect(labelWide).toBe(true);

	await run(page, '__miniplayer');
	await expect(overlay(page)).toHaveCount(1);
	await expect(overlay(page).getByText('Audio only')).toBeHidden();
	await expect(overlay(page).getByRole('button', { name: 'Show video' })).toBeVisible();
});

test('the overlay goes when the mini-player closes and follows it when it expands', async ({
	context
}) => {
	const page = await openYouTube(context);
	await run(page, '__miniplayer');
	await expect(overlay(page)).toHaveCount(1);

	await run(page, '__expand');
	await expect(overlay(page)).toHaveCount(1);
	expect(await page.evaluate(() => location.pathname)).toBe('/watch');
	expect(JSON.stringify(await box(page, 'audiotube-overlay'))).toBe(
		JSON.stringify(await box(page, '#movie_player'))
	);

	await run(page, '__miniplayer');
	await expect(overlay(page)).toHaveCount(1);
	await run(page, '__closeMini');
	await expect(overlay(page)).toHaveCount(0);
});

test('the overlay goes when the mini-player is hidden without leaving the page', async ({
	context
}) => {
	const page = await openYouTube(context);
	await run(page, '__miniplayer');
	await expect(overlay(page)).toHaveCount(1);
	await run(page, '__hideMini');
	await expect(overlay(page)).toHaveCount(0);
});

test('a home page with no mini-player has no overlay', async ({ context }) => {
	const page = await openYouTube(context);
	await page.evaluate(() => (window as unknown as { __navigate(p: string): void }).__navigate('/'));
	await expect(overlay(page)).toHaveCount(0);
});
