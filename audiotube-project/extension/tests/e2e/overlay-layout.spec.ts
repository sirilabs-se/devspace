import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const overlay = (page: Page) => page.locator('audiotube-overlay');

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

async function expectCovered(page: Page) {
	await expect
		.poll(async () => JSON.stringify(await box(page, 'audiotube-overlay')))
		.toBe(JSON.stringify(await box(page, '#movie_player')));
	const player = await box(page, '#movie_player');
	const top = await page.evaluate(
		([x, y]) => document.elementFromPoint(x, y)?.tagName.toLowerCase(),
		[player.x + player.width / 2, player.y + player.height / 2]
	);
	expect(top).toBe('audiotube-overlay');
}

test('covers the player in the normal layout', async ({ context }) => {
	const page = await openYouTube(context);
	await expectCovered(page);
});

test('still covers the player in theater mode, and after leaving it', async ({ context }) => {
	const page = await openYouTube(context);
	const normal = await box(page, '#movie_player');
	await page.locator('#theater').click();
	expect((await box(page, '#movie_player')).width).toBeGreaterThan(normal.width);
	await expectCovered(page);
	await page.locator('#theater').click();
	await expectCovered(page);
});

test('still covers the player when it goes fullscreen, and when it comes back', async ({
	context
}) => {
	const page = await openYouTube(context);
	await page.locator('#fullscreen').click();
	await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('movie_player');
	await expectCovered(page);
	const viewport = page.viewportSize()!;
	const covered = await box(page, 'audiotube-overlay');
	expect([covered.width, covered.height]).toEqual([viewport.width, viewport.height]);

	await page.evaluate(() => document.exitFullscreen());
	await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
	await expectCovered(page);
});

test('keeps covering the player when the window is resized', async ({ context }) => {
	const page = await openYouTube(context);
	await page.setViewportSize({ width: 320, height: 600 });
	expect((await box(page, '#movie_player')).width).toBe(320);
	await expectCovered(page);
	await page.setViewportSize({ width: 1000, height: 700 });
	await expectCovered(page);
});

test("stays on top of YouTube's error screen", async ({ context }) => {
	const page = await openYouTube(context);
	await page.locator('#error').click();
	await expect(page.locator('.ytp-error')).toHaveCount(1);
	await expectCovered(page);
	const error = await box(page, '.ytp-error');
	const top = await page.evaluate(
		([x, y]) => document.elementFromPoint(x, y)?.tagName.toLowerCase(),
		[error.x + error.width / 2, error.y + error.height / 2]
	);
	expect(top).toBe('audiotube-overlay');
	await expect(overlay(page)).toHaveCount(1);
});
