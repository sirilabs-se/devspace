import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
type Win = {
	__startVideo(): Promise<void>;
	__navigate(p: string): void;
	__miniplayer(): void;
	__position: number;
};
type StoredTab = { tabId: number; state: string };
type StoredNow = { videoId: string; positionSec: number };

const playbackTab = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.session.get('playbackTab')).playbackTab)) as
		StoredTab | undefined;
const nowPlaying = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.local.get('nowPlaying')).nowPlaying)) as
		StoredNow | undefined;

async function playing(context: BrowserContext, position = 321) {
	await context.route('https://www.youtube.com/**', (r) =>
		r.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.addInitScript((p) => {
		(window as unknown as { __position: number }).__position = p;
	}, position);
	await page.goto('https://www.youtube.com/watch?v=testvideo01');
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	return page;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const call = (page: Page, name: 'miniplayer' | 'navigate', arg?: string) =>
	page.evaluate(
		([n, a]) => (window as unknown as Record<string, (x?: string) => void>)[`__${n}`](a),
		[name, arg] as const
	);

test('leaving the watch page into the mini-player keeps the playback tab, Now Playing and the sound', async ({
	context
}) => {
	const page = await playing(context);
	const tab = (await playbackTab(context))!.tabId;

	await call(page, 'miniplayer');
	expect(await page.evaluate(() => location.pathname)).toBe('/');
	await wait(4000); // longer than any look at the tab after a page change

	expect((await playbackTab(context))!.tabId).toBe(tab);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
	expect(await page.evaluate(() => document.querySelector('video')!.paused)).toBe(false);
	await expect(page.locator('ytd-miniplayer #movie_player > audiotube-overlay')).toHaveCount(1);
});

test('leaving the watch page with no mini-player, as YouTube does, ends the playback but keeps the place', async ({
	context
}) => {
	const page = await playing(context, 400);
	await page.evaluate(() => (window as unknown as Win).__navigate('/'));
	await page.evaluate(() => document.querySelector('video')?.pause());
	await expect.poll(() => playbackTab(context), { timeout: 6000 }).toBeUndefined();
	const now = (await nowPlaying(context))!;
	expect(now.videoId).toBe('testvideo01');
	expect(now.positionSec).toBeGreaterThanOrEqual(400);
	expect(page.isClosed()).toBe(false);
});

test('opening another video in the playback tab replaces Now Playing and the tab stays', async ({
	context
}) => {
	const page = await playing(context);
	const tab = (await playbackTab(context))!.tabId;
	await call(page, 'navigate', '/watch?v=testvideo03');
	await expect.poll(() => nowPlaying(context)).toMatchObject({ videoId: 'testvideo03' });
	await wait(4000);
	expect((await playbackTab(context))!.tabId).toBe(tab);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo03' });
});

test('reloading the YouTube page keeps the tab as the playback tab', async ({ context }) => {
	const page = await playing(context);
	const tab = (await playbackTab(context))!.tabId;
	await page.reload();
	await wait(4500);
	expect((await playbackTab(context))!.tabId).toBe(tab);
	expect(await nowPlaying(context)).toMatchObject({ videoId: 'testvideo01' });
	await expect.poll(async () => (await playbackTab(context))?.state).toBe('paused');
});
