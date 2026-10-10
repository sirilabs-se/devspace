import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const button = (page: Page) => page.locator('audiotube-control');
const overlay = (page: Page) => page.locator('audiotube-overlay');
const panelSwitch = (page: Page) => page.getByRole('switch', { name: 'Audio only' });

async function worker(context: BrowserContext) {
	return getWorker(context);
}

async function openYouTube(context: BrowserContext, init?: string) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	if (init) await page.addInitScript(init);
	await page.goto('https://www.youtube.com/watch?v=test1');
	return page;
}

test('no button while audio-only is on', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);
	await expect(button(page)).toHaveCount(0);
});

test('the button appears in the control bar while the video is shown, and turns audio-only on', async ({
	context,
	extensionId
}) => {
	await (await worker(context)).evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const page = await openYouTube(context);
	const panel = await context.newPage();
	await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(panelSwitch(panel)).toHaveAttribute('aria-checked', 'false');

	await expect(button(page)).toHaveCount(1);
	expect(
		await page.evaluate(
			() => !!document.querySelector('.ytp-right-controls-left > audiotube-control')
		)
	).toBe(true);
	await expect(button(page).getByRole('button', { name: 'Audio only' })).toBeVisible();

	await button(page).getByRole('button', { name: 'Audio only' }).click();
	await expect(overlay(page)).toHaveCount(1);
	await expect(button(page)).toHaveCount(0);
	await expect(panelSwitch(panel)).toHaveAttribute('aria-checked', 'true');
});

test('the button comes back when the video is shown again', async ({ context, extensionId }) => {
	const page = await openYouTube(context);
	const panel = await context.newPage();
	await panel.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await panelSwitch(panel).click();
	await expect(button(page)).toHaveCount(1, { timeout: 1000 });
});

test('stays correct when YouTube moves to another video without a reload', async ({ context }) => {
	await (await worker(context)).evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const page = await openYouTube(context);
	await expect(button(page)).toHaveCount(1);
	await page.evaluate(() =>
		(window as unknown as { __navigate(p: string): void }).__navigate('/watch?v=test2')
	);
	await expect(button(page)).toHaveCount(1);
	await page.evaluate(() => (window as unknown as { __navigate(p: string): void }).__navigate('/'));
	await expect(button(page)).toHaveCount(0);
});

test('with no control bar there is no button and no error', async ({ context }) => {
	await (await worker(context)).evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const errors: string[] = [];
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		(window as unknown as { __noControlBar: boolean }).__noControlBar = true;
	});
	await page.goto('https://www.youtube.com/watch?v=test1');
	await page.waitForTimeout(800);
	await expect(button(page)).toHaveCount(0);
	await expect(overlay(page)).toHaveCount(0);
	expect(errors).toEqual([]);
});
