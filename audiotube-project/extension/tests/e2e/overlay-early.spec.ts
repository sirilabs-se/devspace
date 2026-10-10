import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');

const overlay = (page: Page) => page.locator('audiotube-overlay');
const videoVisibility = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.querySelector('video')!).visibility);
const glowDisplay = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.querySelector('#cinematics')!).display);

async function registered(context: BrowserContext): Promise<number> {
	const worker = await getWorker(context);
	return worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length);
}

async function openYouTube(context: BrowserContext, withRecorder = false) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	if (withRecorder) {
		// Notes every frame in which the picture could be seen with no overlay in place.
		await page.addInitScript(() => {
			const w = window as unknown as { __seen: number[] };
			w.__seen = [];
			const check = () => {
				const video = document.querySelector('video');
				if (
					video &&
					getComputedStyle(video).visibility !== 'hidden' &&
					!document.querySelector('audiotube-overlay')
				) {
					w.__seen.push(Math.round(performance.now()));
				}
				requestAnimationFrame(check);
			};
			requestAnimationFrame(check);
		});
	}
	await page.goto('https://www.youtube.com/watch?v=test1');
	return page;
}

const seen = (page: Page) =>
	page.evaluate(() => (window as unknown as { __seen: number[] }).__seen);

test.beforeEach(async ({ context }) => {
	await expect.poll(() => registered(context)).toBe(1);
});

test('the picture is never visible from the first frame until the overlay is in place', async ({
	context
}) => {
	const page = await openYouTube(context, true);
	await expect(overlay(page)).toHaveCount(1);
	await page.waitForTimeout(300);
	expect(await seen(page)).toEqual([]);

	await page.evaluate(() =>
		(window as unknown as { __navigate(p: string): void }).__navigate('/watch?v=test2')
	);
	await expect(overlay(page)).toHaveCount(1);
	await page.waitForTimeout(300);
	expect(await seen(page)).toEqual([]);
});

test('the ambient glow is hidden while audio-only is on and shown again when it turns off', async ({
	context
}) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);
	expect(await glowDisplay(page)).toBe('none');

	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect.poll(() => glowDisplay(page)).not.toBe('none');
	await expect(overlay(page)).toHaveCount(0);

	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: true }));
	await expect.poll(() => glowDisplay(page)).toBe('none');
});

test('turning audio-only off on an open page shows the picture again', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);
	expect(await videoVisibility(page)).toBe('hidden');

	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect.poll(() => videoVisibility(page), { timeout: 1000 }).toBe('visible');
});

test('with audio-only off the early CSS is not added to new pages', async ({ context }) => {
	const worker = await getWorker(context);
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	await expect.poll(() => registered(context)).toBe(0);

	const page = await openYouTube(context);
	await page.waitForTimeout(300);
	expect(await videoVisibility(page)).toBe('visible');
	expect(await glowDisplay(page)).not.toBe('none');
	await expect(overlay(page)).toHaveCount(0);

	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: true }));
	await expect.poll(() => registered(context)).toBe(1);
});
