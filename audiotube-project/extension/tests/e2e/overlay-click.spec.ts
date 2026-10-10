import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
type Win = {
	__startVideo(): Promise<void>;
	__playbackCalls: string[];
	__keys: string[];
};

const overlay = (page: Page) => page.locator('audiotube-overlay');
const showVideo = (page: Page) => overlay(page).getByRole('button', { name: 'Show video' });
const paused = (page: Page) => page.evaluate(() => document.querySelector('video')!.paused);
const calls = (page: Page) => page.evaluate(() => (window as unknown as Win).__playbackCalls);

async function openYouTube(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.goto('https://www.youtube.com/watch?v=test1');
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	await expect(overlay(page)).toHaveCount(1);
	return page;
}

async function clickPictureArea(page: Page) {
	const box = (await overlay(page).boundingBox())!;
	await page.mouse.click(box.x + 40, box.y + 40);
}

test('clicking the overlay pauses a playing video and plays a paused one', async ({ context }) => {
	const page = await openYouTube(context);
	expect(await paused(page)).toBe(false);

	await clickPictureArea(page);
	await expect.poll(() => paused(page)).toBe(true);
	await clickPictureArea(page);
	await expect.poll(() => paused(page)).toBe(false);
	expect(await calls(page)).toEqual(['pause', 'play']);
});

test('clicking Show video neither pauses nor plays', async ({ context }) => {
	const page = await openYouTube(context);
	await showVideo(page).click();
	await expect(overlay(page)).toHaveCount(0);
	expect(await calls(page)).toEqual([]);
	expect(await paused(page)).toBe(false);
});

test("YouTube's shortcuts still reach the page after clicking the overlay", async ({ context }) => {
	const page = await openYouTube(context);
	await clickPictureArea(page);
	await page.keyboard.press(' ');
	await page.keyboard.press('k');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('m');
	expect(await page.evaluate(() => (window as unknown as Win).__keys)).toEqual([
		' ',
		'k',
		'ArrowLeft',
		'ArrowRight',
		'm'
	]);
	const active = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
	expect(active).not.toBe('audiotube-overlay');
});

test('a mouse click on Show video that fails does not leave focus on the button', async ({
	context
}) => {
	const page = await openYouTube(context);
	const worker = await getWorker(context);
	await worker.evaluate(() => {
		chrome.storage.local.set = () => Promise.reject(new Error('Storage is not available'));
	});
	await showVideo(page).click();
	await expect(overlay(page).getByRole('alert')).toBeVisible();
	expect(await page.evaluate(() => document.activeElement?.tagName.toLowerCase())).not.toBe(
		'audiotube-overlay'
	);
	await page.keyboard.press('k');
	expect(await page.evaluate(() => (window as unknown as Win).__keys)).toEqual(['k']);
});

test('Show video can be reached and pressed from the keyboard', async ({ context }) => {
	const page = await openYouTube(context);
	const active = () => page.evaluate(() => document.activeElement?.tagName.toLowerCase());
	for (let presses = 0; presses < 12 && (await active()) !== 'audiotube-overlay'; presses++) {
		await page.keyboard.press('Tab');
	}
	expect(await active()).toBe('audiotube-overlay');
	await page.keyboard.press('Space');
	await expect(overlay(page)).toHaveCount(0);
});
