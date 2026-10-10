import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');
type Win = { __startVideo(): Promise<void>; __position: number; __duration: number };

async function route(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	await context.route('https://i.ytimg.com/**', (r) =>
		r.fulfill({ contentType: 'image/gif', body: GIF })
	);
}

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(page.getByRole('switch', { name: 'Audio only' })).toBeVisible();
	return page;
}

async function play(context: BrowserContext, init?: () => void) {
	await route(context);
	const page = await context.newPage();
	await page.addInitScript(() => {
		const w = window as unknown as { __position: number };
		w.__position = 10;
	});
	if (init) await page.addInitScript(init);
	await page.goto('https://www.youtube.com/watch?v=testvideo01');
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	return page;
}

const bar = (panel: Page) => panel.getByRole('slider', { name: 'Seek' });
const elapsed = async (panel: Page) => Number(await bar(panel).inputValue());
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('while playing, elapsed time goes up by one a second and the bar moves', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await play(context);
	await expect(bar(panel)).toBeVisible();
	const first = await elapsed(panel);
	const fractionAt = parseFloat(
		await bar(panel).evaluate((el) => el.style.getPropertyValue('--p'))
	);
	await wait(3100);
	const later = await elapsed(panel);
	expect(later - first).toBeGreaterThanOrEqual(2);
	expect(later - first).toBeLessThanOrEqual(4);
	const fractionLater = parseFloat(
		await bar(panel).evaluate((el) => el.style.getPropertyValue('--p'))
	);
	expect(fractionLater).toBeGreaterThan(fractionAt);
	// The right-hand time is the length of the video, 3:32 for the 212 seconds of the test page.
	await expect(panel.getByRole('region', { name: 'Now playing' })).toContainText('3:32');
	await expect(panel.getByRole('region', { name: 'Now playing' })).not.toContainText('-3:');
});

test('on pause, the time and the bar stop within a second', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(bar(panel)).toBeVisible();
	await wait(1500);
	await page.evaluate(() => document.querySelector('video')!.pause());
	await wait(1100);
	const stopped = await elapsed(panel);
	await wait(2200);
	expect(await elapsed(panel)).toBe(stopped);
});

test('a seek made on the page shows in the panel within a second', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(bar(panel)).toBeVisible();
	await page.evaluate(() => {
		(window as unknown as Win).__position = 150;
		document.querySelector('video')!.dispatchEvent(new Event('seeked'));
	});
	await expect.poll(() => elapsed(panel), { timeout: 1500 }).toBeGreaterThanOrEqual(150);
	expect(await elapsed(panel)).toBeLessThan(153);
});

test('at double speed, elapsed time goes up by two each second', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(bar(panel)).toBeVisible();
	await page.evaluate(() => {
		document.querySelector('video')!.playbackRate = 2;
	});
	await wait(1200);
	const first = await elapsed(panel);
	await wait(3000);
	const delta = (await elapsed(panel)) - first;
	expect(delta).toBeGreaterThanOrEqual(5);
	expect(delta).toBeLessThanOrEqual(7);
});

test('the count never goes past the duration, which stays the same', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context, () => {
		(window as unknown as { __duration: number }).__duration = 20;
	});
	await page.evaluate(() => {
		(window as unknown as Win).__position = 17;
		document.querySelector('video')!.dispatchEvent(new Event('seeked'));
	});
	await wait(6000);
	expect(await elapsed(panel)).toBeLessThanOrEqual(20);
	await expect(panel.getByRole('region', { name: 'Now playing' })).toContainText('0:20');
	expect(await bar(panel).inputValue()).toBe('20');
});

test('a live stream shows Live and no times', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	await play(context, () => {
		(window as unknown as { __isLive: boolean }).__isLive = true;
	});
	const card = panel.getByRole('region', { name: 'Now playing' });
	await expect(card.getByText('Live', { exact: true })).toBeVisible();
	await expect(card.getByRole('slider', { name: 'Seek' })).toHaveCount(0);
	await expect(card).not.toContainText(/\d:\d\d/);
});

test('while buffering the card says Buffering and the bar stops', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(bar(panel)).toBeVisible();
	await page.evaluate(() => {
		(window as unknown as { __buffering: boolean }).__buffering = true;
		document.querySelector('video')!.dispatchEvent(new Event('waiting'));
	});
	const card = panel.getByRole('region', { name: 'Now playing' });
	await expect(card.getByText('Buffering')).toBeVisible({ timeout: 1500 });
	await wait(500);
	const stopped = await elapsed(panel);
	await wait(2200);
	expect(await elapsed(panel)).toBe(stopped);

	await page.evaluate(() => {
		(window as unknown as { __buffering: boolean }).__buffering = false;
		document.querySelector('video')!.dispatchEvent(new Event('playing'));
	});
	await expect(card.getByText('Buffering')).toHaveCount(0, { timeout: 1500 });
});

test('with no playback tab the bar shows the saved position and does not move', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(bar(panel)).toBeVisible();
	await page.close();
	const card = panel.getByRole('region', { name: 'Now playing' });
	await expect(card.getByRole('button', { name: 'Resume' })).toBeVisible();
	const saved = await elapsed(panel);
	await wait(2200);
	expect(await elapsed(panel)).toBe(saved);
});

test('with the YouTube tab in the background the bar still moves every second', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await play(context);
	await expect(bar(panel)).toBeVisible();
	await panel.bringToFront();
	const first = await elapsed(panel);
	await wait(3200);
	expect((await elapsed(panel)) - first).toBeGreaterThanOrEqual(2);
});
