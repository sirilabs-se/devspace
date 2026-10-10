import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
type Calls = [string, string | null][];

const preference = (quality: number) =>
	JSON.stringify({ data: JSON.stringify({ quality, previousQuality: 0 }), creation: 1 });
const calls = (page: Page) =>
	page.evaluate(() => (window as unknown as { __qualityCalls: Calls }).__qualityCalls);
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const panelSwitch = (page: Page) => page.getByRole('switch', { name: 'Audio only' });

async function openYouTube(
	context: BrowserContext,
	options: { pref?: number; setup?: string } = {}
) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	if (options.pref !== undefined) {
		await page.addInitScript(
			([key, value]) => localStorage.setItem(key, value),
			['yt-player-quality', preference(options.pref)]
		);
	}
	if (options.setup) await page.addInitScript(options.setup);
	await page.goto('https://www.youtube.com/watch?v=test1');
	return page;
}

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(panelSwitch(page)).toBeVisible();
	return page;
}

test('audio-only on asks for the lowest quality; off puts the earlier choice back', async ({
	context,
	extensionId
}) => {
	const page = await openYouTube(context, { pref: 720 });
	await expect.poll(() => calls(page)).toEqual([['tiny', 'tiny']]);

	const panel = await openPanel(context, extensionId);
	await panelSwitch(panel).click();
	await expect
		.poll(() => calls(page))
		.toEqual([
			['tiny', 'tiny'],
			['hd720', 'hd720']
		]);
	expect(await stored(page, 'audiotube.previousQuality')).toBeNull();

	await panelSwitch(panel).click();
	await expect.poll(async () => (await calls(page)).at(-1)).toEqual(['tiny', 'tiny']);
	expect(await stored(page, 'audiotube.previousQuality')).toBe('hd720');
});

test('puts Auto back when the user had Auto', async ({ context, extensionId }) => {
	const page = await openYouTube(context);
	await expect.poll(() => calls(page)).toEqual([['tiny', 'tiny']]);
	const panel = await openPanel(context, extensionId);
	await panelSwitch(panel).click();
	await expect.poll(async () => (await calls(page)).at(-1)).toEqual(['auto', null]);
});

test('asks again for the next video after YouTube moves on without a reload', async ({
	context
}) => {
	const page = await openYouTube(context, { pref: 720 });
	await expect.poll(() => calls(page)).toEqual([['tiny', 'tiny']]);
	await page.evaluate(() =>
		(window as unknown as { __navigate(p: string): void }).__navigate('/watch?v=test2')
	);
	await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(1);
	expect((await calls(page)).at(-1)).toEqual(['tiny', 'tiny']);
});

test('asks for nothing when Save bandwidth is off', async ({ context }) => {
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
	await worker.evaluate(() => chrome.storage.local.set({ saveBandwidth: false }));
	const page = await openYouTube(context, { pref: 720 });
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await page.waitForTimeout(800);
	expect(await calls(page)).toEqual([]);
	expect(await stored(page, 'yt-player-quality')).toBe(preference(720));
});

test('a reload while on still puts back the original choice, not the lowest', async ({
	context,
	extensionId
}) => {
	const page = await openYouTube(context, { pref: 720 });
	await expect.poll(() => calls(page)).toEqual([['tiny', 'tiny']]);
	await page.reload();
	await expect.poll(() => calls(page)).toEqual([['tiny', 'tiny']]);

	const panel = await openPanel(context, extensionId);
	await panelSwitch(panel).click();
	await expect.poll(async () => (await calls(page)).at(-1)).toEqual(['hd720', 'hd720']);
});

test('if the player refuses the request the overlay stays and nothing breaks', async ({
	context
}) => {
	const errors: string[] = [];
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	await page.addInitScript(() => {
		(window as unknown as { __failQuality: boolean }).__failQuality = true;
	});
	await page.goto('https://www.youtube.com/watch?v=test1');
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await expect.poll(async () => (await calls(page)).length).toBeGreaterThan(0);
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	expect(errors).toEqual([]);
});

test('if the page has no quality methods nothing is asked and nothing breaks', async ({
	context
}) => {
	const errors: string[] = [];
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	await page.addInitScript(() => {
		(window as unknown as { __noApi: boolean }).__noApi = true;
	});
	await page.goto('https://www.youtube.com/watch?v=test1');
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await page.waitForTimeout(800);
	expect(await calls(page)).toEqual([]);
	expect(errors).toEqual([]);
});
