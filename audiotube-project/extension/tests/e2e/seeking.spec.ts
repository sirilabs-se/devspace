import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');
type Win = { __startVideo(): Promise<void>; __position: number; __seekCalls: number[] };

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(page.getByRole('switch', { name: 'Audio only' })).toBeVisible();
	return page;
}

async function play(context: BrowserContext, init?: () => void) {
	await context.route('https://www.youtube.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	await context.route('https://i.ytimg.com/**', (r) =>
		r.fulfill({ contentType: 'image/gif', body: GIF })
	);
	const page = await context.newPage();
	await page.addInitScript(() => {
		(window as unknown as { __position: number }).__position = 10;
	});
	if (init) await page.addInitScript(init);
	await page.goto('https://www.youtube.com/watch?v=testvideo01');
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	return page;
}

const slider = (panel: Page) => panel.getByRole('slider', { name: 'Seek' });
const seekCalls = (page: Page) => page.evaluate(() => (window as unknown as Win).__seekCalls ?? []);
const position = (page: Page) => page.evaluate(() => (window as unknown as Win).__position);

async function barBox(panel: Page) {
	return (await slider(panel).boundingBox())!;
}

test('clicking the middle of the bar moves the player to about half, and the panel shows it', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeEnabled();
	const box = await barBox(panel);
	await panel.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

	await expect.poll(() => seekCalls(page), { timeout: 1500 }).toHaveLength(1);
	const target = (await seekCalls(page))[0]!;
	expect(target).toBeGreaterThan(95);
	expect(target).toBeLessThan(118);
	await expect
		.poll(async () => Number(await slider(panel).inputValue()), { timeout: 1500 })
		.toBeGreaterThan(94);
});

test('dragging and releasing seeks once, to where the drag ended', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeEnabled();
	const box = await barBox(panel);
	const y = box.y + box.height / 2;
	await panel.mouse.move(box.x + box.width * 0.2, y);
	await panel.mouse.down();
	await panel.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
	await panel.mouse.move(box.x + box.width * 0.75, y, { steps: 6 });
	// While dragging nothing has been sent to the player.
	expect(await seekCalls(page)).toHaveLength(0);
	await panel.mouse.up();

	await expect.poll(() => seekCalls(page), { timeout: 1500 }).toHaveLength(1);
	await panel.waitForTimeout(500);
	const calls = await seekCalls(page);
	expect(calls).toHaveLength(1);
	expect(calls[0]!).toBeGreaterThan(212 * 0.68);
	expect(calls[0]!).toBeLessThan(212 * 0.82);
});

test('with the bar focused the arrow keys move five seconds', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeEnabled();
	await page.evaluate(() => {
		(window as unknown as Win).__position = 100;
		document.querySelector('video')!.dispatchEvent(new Event('seeked'));
	});
	await expect
		.poll(async () => Number(await slider(panel).inputValue()))
		.toBeGreaterThanOrEqual(100);
	// Hold the video still so the arithmetic is exact.
	await page.evaluate(() => document.querySelector('video')!.pause());
	await expect.poll(async () => await slider(panel).inputValue()).toBe('100');

	await slider(panel).focus();
	await panel.keyboard.press('ArrowRight');
	await expect.poll(() => position(page)).toBe(105);
	await expect.poll(async () => slider(panel).inputValue()).toBe('105');
	await panel.keyboard.press('ArrowLeft');
	await panel.keyboard.press('ArrowLeft');
	await expect.poll(() => position(page)).toBe(95);
});

test('a seek from the panel while an ad is showing changes nothing', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeEnabled();
	await page.evaluate(() => document.querySelector('#movie_player')!.classList.add('ad-showing'));

	await slider(panel).focus();
	await panel.keyboard.press('ArrowRight');
	const box = await barBox(panel);
	await panel.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
	await panel.waitForTimeout(1200);
	expect(await seekCalls(page)).toEqual([]);
});

test('the bar cannot be used for a live stream or without a playback tab', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeEnabled();
	await page.close();
	await expect(panel.getByRole('button', { name: 'Resume' })).toBeVisible();
	await expect(slider(panel)).toBeDisabled();
});

test('a live stream has no bar to seek with', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	await play(context, () => {
		(window as unknown as { __isLive: boolean }).__isLive = true;
	});
	await expect(panel.getByText('Live', { exact: true })).toBeVisible();
	await expect(slider(panel)).toHaveCount(0);
});

test('the bar is reachable by keyboard and announced as a slider with a time', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await play(context);
	await expect(slider(panel)).toBeEnabled();
	await expect(slider(panel)).toHaveAttribute('aria-valuetext', /\d+:\d\d, \d+:\d\d left/);
	for (let i = 0; i < 12; i++) {
		await panel.keyboard.press('Tab');
		if (await slider(panel).evaluate((el) => el === document.activeElement)) break;
	}
	await expect(slider(panel)).toBeFocused();
});
