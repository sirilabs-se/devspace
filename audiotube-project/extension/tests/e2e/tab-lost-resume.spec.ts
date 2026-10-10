import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');
type Win = { __startVideo(): Promise<void> };
type PlaybackTabStored = { tabId: number; windowId: number; state: string };
type NowPlayingStored = { videoId: string; positionSec: number };

async function route(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	await context.route('https://i.ytimg.com/**', (r) =>
		r.fulfill({ contentType: 'image/gif', body: GIF })
	);
	await context.route('https://example.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: '<p>Another site</p>' })
	);
}

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(page.getByRole('switch', { name: 'Audio only' })).toBeVisible();
	return page;
}

/** A tab playing a video at the given position (12:30 is 750 seconds). */
async function playAt(context: BrowserContext, positionSec: number, video = 'testvideo01') {
	await route(context);
	const page = await context.newPage();
	await page.addInitScript((p) => {
		(window as unknown as { __position: number }).__position = p;
	}, positionSec);
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	return page;
}

const playbackTab = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.session.get('playbackTab')).playbackTab)) as
		PlaybackTabStored | undefined;
const nowPlaying = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.local.get('nowPlaying')).nowPlaying)) as
		NowPlayingStored | undefined;
const card = (panel: Page) => panel.getByRole('region', { name: 'Now playing' });

test('closing the playback tab shows the video paused at its position, with Resume', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await playAt(context, 750);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();

	await page.close();
	await expect(card(panel).getByText(/Paused at 12:3\d/)).toBeVisible();
	await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();
	expect(await playbackTab(context)).toBeUndefined();
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
	expect((await nowPlaying(context))!.positionSec).toBeGreaterThanOrEqual(750);
});

test('the same when the tab moves to another site', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	const page = await playAt(context, 750);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();

	await page.goto('https://example.com/');
	await expect(card(panel).getByText(/Paused at 12:3\d/)).toBeVisible();
	await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();
	expect(page.isClosed()).toBe(false);
});

test('a discarded playback tab is lost too', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	await playAt(context, 750);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();
	const stored = (await playbackTab(context))!;

	await (await getWorker(context)).evaluate((id) => chrome.tabs.discard(id), stored.tabId);
	await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();
});

test('Resume opens a new tab without moving focus, and plays from about the same place', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await playAt(context, 750);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.close();
	await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();

	const worker = await getWorker(context);
	await panel.bringToFront();
	const activeBefore = await worker.evaluate(
		async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
	);
	const opened = context.waitForEvent('page');
	await card(panel).getByRole('button', { name: 'Resume' }).click();
	const resumed = await opened;
	await expect.poll(() => resumed.url()).toMatch(/watch\?v=testvideo01&t=75\ds/);

	// The first request of a tab the extension opens is not routed by the test, so load it again.
	await resumed.goto(resumed.url());

	const activeAfter = await worker.evaluate(
		async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
	);
	expect(activeAfter).toBe(activeBefore);

	await expect
		.poll(async () => (await playbackTab(context))?.state, { timeout: 15_000 })
		.toBe('playing');
	const now = (await nowPlaying(context))!;
	expect(now.positionSec).toBeGreaterThanOrEqual(749);
	expect(now.positionSec).toBeLessThan(760);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('when the resumed tab does not start, the panel says it is waiting', async ({
	context,
	extensionId
}) => {
	await context.addInitScript(() => {
		(window as unknown as { __noAutoplay: boolean }).__noAutoplay = true;
	});
	const panel = await openPanel(context, extensionId);
	const page = await playAt(context, 750);
	await expect(card(panel).getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.close();
	await card(panel).getByRole('button', { name: 'Resume' }).click();

	await expect(card(panel).getByRole('button', { name: 'Go to video' })).toBeEnabled();
	await expect(card(panel).getByText('Waiting to start')).toBeVisible({ timeout: 14_000 });
});

test('after a browser restart Now Playing shows paused with Resume and nothing plays', async () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'audiotube-resume-'));
	const launch = () =>
		chromium.launchPersistentContext(dir, {
			channel: 'chromium',
			args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
		});
	try {
		const first = await launch();
		const page = await playAt(first, 750);
		await expect.poll(() => playbackTab(first)).toBeTruthy();
		await expect.poll(() => nowPlaying(first)).toBeTruthy();
		void page;
		await first.close();

		const second = await launch();
		const worker = await getWorker(second);
		const extensionId = new URL(worker.url()).host;
		await route(second);
		const panel = await openPanel(second, extensionId);
		await expect(card(panel).getByText(/Paused at 12:3\d/)).toBeVisible();
		await expect(card(panel).getByRole('button', { name: 'Resume' })).toBeVisible();
		await panel.waitForTimeout(2500);
		const youtubeTabs = await worker.evaluate(
			async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' })).length
		);
		expect(youtubeTabs).toBe(0);
		expect(await playbackTab(second)).toBeUndefined();
		await second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
