import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
type Win = { __startVideo(): Promise<void>; __navigate(p: string): void };
type StoredPlaybackTab = { tabId: number; windowId: number; state: string };
type StoredNowPlaying = { videoId: string };

const playbackTab = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.session.get('playbackTab')).playbackTab)) as
		StoredPlaybackTab | undefined;
const nowPlaying = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.local.get('nowPlaying')).nowPlaying)) as
		StoredNowPlaying | undefined;

const paused = (page: Page) => page.evaluate(() => document.querySelector('video')!.paused);
const play = (page: Page) => page.evaluate(() => (window as unknown as Win).__startVideo());

async function route(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
}

async function openTab(context: BrowserContext, video: string) {
	await route(context);
	const page = await context.newPage();
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	return page;
}

async function openInNewWindow(context: BrowserContext, video: string) {
	await route(context);
	const worker = await getWorker(context);
	const opened = context.waitForEvent('page');
	await worker.evaluate(
		(url) => chrome.windows.create({ url, focused: false }),
		`https://www.youtube.com/watch?v=${video}`
	);
	const page = await opened;
	// The window's first request starts before the page is routed, so load it again through the route.
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	return page;
}

test('when another tab starts playing it takes over and the old one is paused, not closed', async ({
	context
}) => {
	const a = await openTab(context, 'testvideo01');
	await play(a);
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	const aId = (await playbackTab(context))!.tabId;

	const b = await openTab(context, 'testvideo02');
	await play(b);

	await expect.poll(async () => (await playbackTab(context))?.tabId).not.toBe(aId);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo02' });
	await expect.poll(() => paused(a)).toBe(true);
	expect(a.isClosed()).toBe(false);
	expect(await paused(b)).toBe(false);
});

test('the same when the two tabs are in different windows', async ({ context }) => {
	const a = await openTab(context, 'testvideo01');
	await play(a);
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	const first = (await playbackTab(context))!;

	const b = await openInNewWindow(context, 'testvideo02');
	await play(b);

	await expect.poll(async () => (await playbackTab(context))?.tabId).not.toBe(first.tabId);
	const second = (await playbackTab(context))!;
	expect(second.windowId).not.toBe(first.windowId);
	await expect.poll(() => paused(a)).toBe(true);
	expect(a.isClosed()).toBe(false);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo02' });
});

test('opening another video in the playback tab replaces Now Playing', async ({ context }) => {
	const a = await openTab(context, 'testvideo01');
	await play(a);
	await expect.poll(() => nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
	const tab = (await playbackTab(context))!.tabId;

	await a.evaluate(() => (window as unknown as Win).__navigate('/watch?v=testvideo03'));
	await expect.poll(() => nowPlaying(context)).toMatchObject({ videoId: 'testvideo03' });
	expect((await playbackTab(context))!.tabId).toBe(tab);
});

test('a tab that only loads a video never takes over', async ({ context }) => {
	const a = await openTab(context, 'testvideo01');
	await play(a);
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	const first = (await playbackTab(context))!;

	const b = await openTab(context, 'testvideo02');
	await b.waitForTimeout(3000);

	expect(await playbackTab(context)).toMatchObject({ tabId: first.tabId, state: 'playing' });
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
	expect(await paused(a)).toBe(false);
});

test('a tab that is paused cannot take over either', async ({ context }) => {
	const a = await openTab(context, 'testvideo01');
	await play(a);
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	const first = (await playbackTab(context))!;

	const b = await openTab(context, 'testvideo02');
	await b.evaluate(() => document.querySelector('video')!.pause());
	await b.waitForTimeout(2500);

	expect((await playbackTab(context))!.tabId).toBe(first.tabId);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
});
