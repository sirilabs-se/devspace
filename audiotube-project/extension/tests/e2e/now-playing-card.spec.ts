import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');
type Win = { __startVideo(): Promise<void>; __showPreview(): void };

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

async function playVideo(context: BrowserContext, video = 'testvideo01', init?: () => void) {
	await route(context);
	const page = await context.newPage();
	if (init) await page.addInitScript(init);
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	return page;
}

const card = (panel: Page) => panel.getByRole('region', { name: 'Now playing' });
const paused = (page: Page) => page.evaluate(() => document.querySelector('video')!.paused);

test('shows Nothing playing on a fresh install', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	await expect(card(panel).getByText('Nothing playing')).toBeVisible();
});

test('shows the thumbnail, title and channel of what is playing', async ({
	context,
	extensionId
}) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	await playVideo(context);
	await expect(card(panel).getByRole('heading')).toHaveText('Test video testvideo01');
	await expect(card(panel).getByText('Test channel')).toBeVisible();
	await expect(card(panel).locator('img')).toHaveAttribute(
		'src',
		'https://i.ytimg.com/vi/testvideo01/mqdefault.jpg'
	);
});

test('a title containing markup shows as plain text', async ({ context, extensionId }) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const markup = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
	await playVideo(context, 'testvideo01', () => {
		(window as unknown as { __title: string }).__title =
			'<img src=x onerror="window.__pwned=1"><b>bold</b>';
	});
	await expect(card(panel).getByRole('heading')).toHaveText(markup);
	expect(await card(panel).locator('img').count()).toBe(1);
	expect(await card(panel).locator('b').count()).toBe(0);
	expect(
		await panel.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)
	).toBeUndefined();
});

test('pause and play from the side panel change the player within a second', async ({
	context,
	extensionId
}) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const page = await playVideo(context);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();

	await card(panel).getByRole('button', { name: 'Pause' }).click();
	await expect.poll(() => paused(page), { timeout: 1000 }).toBe(true);
	await expect(card(panel).getByRole('button', { name: 'Play' })).toBeVisible();

	await card(panel).getByRole('button', { name: 'Play' }).click();
	await expect.poll(() => paused(page), { timeout: 1000 }).toBe(false);
});

test("pausing on YouTube changes the panel's button within a second", async ({
	context,
	extensionId
}) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const page = await playVideo(context);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();

	// A click on the overlay, as a listener would do it.
	const box = (await page.locator('audiotube-overlay').boundingBox())!;
	await page.mouse.click(box.x + 40, box.y + 40);
	await expect(card(panel).getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 1000 });

	await page.keyboard.press('k');
	await expect.poll(() => paused(page)).toBe(true);
});

test('Go to video brings the playback tab and its window to the front', async ({
	context,
	extensionId
}) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const page = await playVideo(context);
	const worker = await getWorker(context);
	await expect(card(panel).getByRole('button', { name: 'Go to video' })).toBeEnabled();

	// Another window comes to the front, then the panel asks for the video.
	await worker.evaluate(() => chrome.windows.create({ url: 'about:blank', focused: true }));
	await card(panel).getByRole('button', { name: 'Go to video' }).click();

	const state = await worker.evaluate(async () => {
		const { playbackTab } = (await chrome.storage.session.get('playbackTab')) as {
			playbackTab: { tabId: number; windowId: number };
		};
		const tab = await chrome.tabs.get(playbackTab.tabId);
		const win = await chrome.windows.get(playbackTab.windowId);
		return { active: tab.active, focused: win.focused };
	});
	expect(state.active).toBe(true);
	expect(state.focused).toBe(true);
	void page;
});

test('the card stays the same while the user switches tabs', async ({ context, extensionId }) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const page = await playVideo(context);
	await expect(card(panel).getByRole('heading')).toHaveText('Test video testvideo01');

	const other = await context.newPage();
	await other.goto('about:blank');
	await other.bringToFront();
	await page.waitForTimeout(500);
	await expect(card(panel).getByRole('heading')).toHaveText('Test video testvideo01');
	await page.bringToFront();
	await expect(card(panel).getByRole('heading')).toHaveText('Test video testvideo01');
});

test('with no playback tab the video shows paused with Resume, and Go to video is disabled', async ({
	context,
	extensionId
}) => {
	const worker = await getWorker(context);
	await worker.evaluate(() =>
		chrome.storage.local.set({
			nowPlaying: {
				videoId: 'testvideo09',
				title: 'Left from before',
				channel: 'Someone',
				durationSec: 60,
				isLive: false,
				positionSec: 5,
				positionSavedAt: 1700000000000,
				updatedAt: 1700000000000
			}
		})
	);
	const panel = await openPanel(context, extensionId);
	await expect(card(panel).getByRole('heading')).toHaveText('Left from before');
	await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();
	await expect(card(panel).getByRole('button', { name: 'Play' })).toHaveCount(0);
	await expect(card(panel).getByRole('button', { name: 'Go to video' })).toBeDisabled();
});

for (const width of [320, 600]) {
	test(`a long title fits at ${width} px wide`, async ({ context, extensionId }) => {
		await route(context);
		const panel = await openPanel(context, extensionId);
		await playVideo(context, 'testvideo01', () => {
			(window as unknown as { __title: string }).__title = 'A very long title '.repeat(20);
		});
		await expect(card(panel).getByRole('heading')).toContainText('A very long title');
		await panel.setViewportSize({ width, height: 700 });
		const overflow = await panel.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
	});
}

test('the play button works from the keyboard and is labelled', async ({
	context,
	extensionId
}) => {
	await route(context);
	const panel = await openPanel(context, extensionId);
	const page = await playVideo(context);
	const button = card(panel).getByRole('button', { name: 'Pause' });
	await expect(button).toBeVisible();
	await button.focus();
	await panel.keyboard.press('Space');
	await expect.poll(() => paused(page)).toBe(true);
	await expect(card(panel).getByRole('button', { name: 'Play' })).toBeFocused();
});
