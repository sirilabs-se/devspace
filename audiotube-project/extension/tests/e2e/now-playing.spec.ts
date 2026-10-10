import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const VIDEO = 'testvideo01';
type Win = {
	__startVideo(): Promise<void>;
	__position: number;
	__navigate(p: string): void;
	__showPreview(): void;
};

type StoredNowPlaying = {
	videoId: string;
	title: string;
	channel: string;
	positionSec: number;
	positionSavedAt: number;
};
type StoredPlaybackTab = { tabId: number; state: string };

const nowPlaying = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.local.get('nowPlaying')).nowPlaying)) as
		StoredNowPlaying | undefined;
const playbackTab = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.session.get('playbackTab')).playbackTab)) as
		StoredPlaybackTab | undefined;

async function openYouTube(context: BrowserContext, init?: () => void, video = VIDEO) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	if (init) await page.addInitScript(init);
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	return page;
}

const play = (page: Page) => page.evaluate(() => (window as unknown as Win).__startVideo());

test('playing a video stores Now Playing and makes the tab the playback tab', async ({
	context
}) => {
	const page = await openYouTube(context);
	await play(page);
	await expect
		.poll(() => nowPlaying(context))
		.toMatchObject({
			videoId: VIDEO,
			title: `Test video ${VIDEO}`,
			channel: 'Test channel',
			durationSec: 212,
			isLive: false
		});
	const tabs = await (
		await getWorker(context)
	).evaluate(async () =>
		(await chrome.tabs.query({ url: 'https://www.youtube.com/*' })).map((t) => t.id)
	);
	const stored = (await playbackTab(context))!;
	expect(tabs).toContain(stored.tabId);
	expect(stored.state).toBe('playing');
});

test('nothing is stored for a video that is only loaded', async ({ context }) => {
	await openYouTube(context);
	await new Promise((resolve) => setTimeout(resolve, 2500));
	expect(await nowPlaying(context)).toBeUndefined();
	expect(await playbackTab(context)).toBeUndefined();
});

test('pausing stores the state and the position', async ({ context }) => {
	const page = await openYouTube(context);
	await play(page);
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'playing' });
	await page.evaluate(() => {
		(window as unknown as Win).__position = 77;
		document.querySelector('video')!.pause();
	});
	await expect.poll(() => playbackTab(context)).toMatchObject({ state: 'paused' });
	await expect.poll(() => nowPlaying(context)).toMatchObject({ positionSec: 77 });
});

test('while playing, the stored position is never more than 5 seconds old', async ({ context }) => {
	const page = await openYouTube(context);
	await play(page);
	await expect.poll(() => nowPlaying(context)).toBeTruthy();
	const ages: number[] = [];
	for (let i = 0; i < 8; i++) {
		await new Promise((resolve) => setTimeout(resolve, 1300));
		const stored = (await nowPlaying(context))!;
		ages.push(Date.now() - stored.positionSavedAt);
	}
	// The report comes every 5 s on a 1 s beat, so the worst case is a little over 5 s plus the message hop.
	expect(Math.max(...ages)).toBeLessThan(6500);
	expect((await nowPlaying(context))!.positionSec).toBeGreaterThan(4);
});

test('a hover-preview player never becomes Now Playing', async ({ context }) => {
	const page = await openYouTube(context);
	await play(page);
	await expect.poll(() => nowPlaying(context)).toMatchObject({ videoId: VIDEO });
	await page.evaluate(() => {
		(window as unknown as Win).__navigate('/');
		(window as unknown as Win).__showPreview();
	});
	await new Promise((resolve) => setTimeout(resolve, 2500));
	expect(await nowPlaying(context)).toMatchObject({ videoId: VIDEO });
});

test('a title or channel longer than the cap is stored cut to the cap', async ({ context }) => {
	const page = await openYouTube(context, () => {
		const w = window as unknown as { __title: string; __author: string };
		w.__title = 'T'.repeat(500);
		w.__author = 'C'.repeat(250);
	});
	await play(page);
	await expect.poll(() => nowPlaying(context)).toBeTruthy();
	const stored = (await nowPlaying(context))!;
	expect(stored.title).toHaveLength(300);
	expect(stored.channel).toHaveLength(100);
});

test('after a browser restart Now Playing is stored and there is no playback tab', async () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'audiotube-restart-'));
	const launch = () =>
		chromium.launchPersistentContext(dir, {
			channel: 'chromium',
			args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
		});
	try {
		const first = await launch();
		const page = await openYouTube(first);
		await play(page);
		await expect.poll(() => playbackTab(first)).toBeTruthy();
		await expect.poll(() => nowPlaying(first)).toMatchObject({ videoId: VIDEO });
		await first.close();

		const second = await launch();
		expect(await nowPlaying(second)).toMatchObject({
			videoId: VIDEO,
			title: `Test video ${VIDEO}`
		});
		expect(await playbackTab(second)).toBeUndefined();
		await second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
