import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');

type PipPage = { __startVideo(): Promise<void>; __pipResult: string | null };

async function openYouTube(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.goto('https://www.youtube.com/watch?v=test1');
	await page.evaluate(() => (window as unknown as PipPage).__startVideo());
	return page;
}

async function tryPip(page: Page): Promise<string | null> {
	await page.evaluate(() => ((window as unknown as PipPage).__pipResult = null));
	await page.locator('#pip').click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as PipPage).__pipResult))
		.not.toBeNull();
	return page.evaluate(() => (window as unknown as PipPage).__pipResult);
}

const pipElement = (page: Page) =>
	page.evaluate(() => document.pictureInPictureElement?.tagName.toLowerCase() ?? null);

test('picture-in-picture cannot be started while audio-only is on, and can after it turns off', async ({
	context
}) => {
	const page = await openYouTube(context);
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	expect(await tryPip(page)).toBe('InvalidStateError');
	expect(await pipElement(page)).toBeNull();

	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect(page.locator('audiotube-overlay')).toHaveCount(0);
	expect(await tryPip(page)).toBe('started');
	expect(await pipElement(page)).toBe('video');
});

test('an open picture-in-picture window closes when audio-only turns on', async ({ context }) => {
	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const page = await openYouTube(context);
	expect(await tryPip(page)).toBe('started');
	expect(await pipElement(page)).toBe('video');

	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: true }));
	await expect.poll(() => pipElement(page), { timeout: 2000 }).toBeNull();
	expect(await tryPip(page)).toBe('InvalidStateError');
});

test('a video YouTube creates later is covered too, and YouTube cannot switch it back on', async ({
	context
}) => {
	const page = await openYouTube(context);
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await page.evaluate(() => {
		document.querySelector('video')!.disablePictureInPicture = false;
	});
	await expect
		.poll(() => page.evaluate(() => document.querySelector('video')!.disablePictureInPicture))
		.toBe(true);

	await page.evaluate(() =>
		(window as unknown as { __navigate(p: string): void }).__navigate('/watch?v=test2')
	);
	await expect
		.poll(() => page.evaluate(() => document.querySelector('video')!.disablePictureInPicture))
		.toBe(true);
});
