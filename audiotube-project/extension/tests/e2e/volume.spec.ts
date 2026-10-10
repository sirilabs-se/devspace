import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const GIF = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64');
type Win = {
	__startVideo(): Promise<void>;
	__volume: number;
	__muted: boolean;
};
type Stored = { level: number; muted: boolean };

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

async function play(context: BrowserContext, video = 'testvideo01', init?: () => void) {
	await route(context);
	const page = await context.newPage();
	if (init) await page.addInitScript(init);
	await page.goto(`https://www.youtube.com/watch?v=${video}`);
	await page.evaluate(() => (window as unknown as Win).__startVideo());
	return page;
}

const stored = async (context: BrowserContext) =>
	(await (
		await getWorker(context)
	).evaluate(async () => (await chrome.storage.local.get('volume')).volume)) as Stored | undefined;
const level = (page: Page) => page.evaluate(() => (window as unknown as Win).__volume);
const muted = (page: Page) => page.evaluate(() => (window as unknown as Win).__muted);
const slider = (panel: Page) => panel.getByRole('slider', { name: 'Volume' });

test('the slider changes YouTube volume within a second, and the mute button mutes and unmutes', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeVisible();

	await slider(panel).fill('30');
	await expect.poll(() => level(page), { timeout: 1000 }).toBe(30);

	await panel.getByRole('button', { name: 'Mute' }).click();
	await expect.poll(() => muted(page), { timeout: 1000 }).toBe(true);
	await expect(panel.getByRole('button', { name: 'Unmute' })).toBeVisible();
	await panel.getByRole('button', { name: 'Unmute' }).click();
	await expect.poll(() => muted(page), { timeout: 1000 }).toBe(false);
	expect(await level(page)).toBe(30);
});

test('a change on the page moves the side panel controls within a second', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeVisible();

	await page.evaluate(() => {
		(
			document.querySelector('#movie_player') as unknown as { setVolume(n: number): void }
		).setVolume(20);
	});
	await expect.poll(async () => slider(panel).inputValue(), { timeout: 1500 }).toBe('20');

	await page.evaluate(() =>
		(document.querySelector('#movie_player') as unknown as { mute(): void }).mute()
	);
	await expect(panel.getByRole('button', { name: 'Unmute' })).toBeVisible({ timeout: 1500 });
});

test('a volume change in a tab that is not the playback tab changes nothing', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await play(context, 'testvideo01');
	await expect(slider(panel)).toBeVisible();
	await slider(panel).fill('45');
	await expect.poll(() => stored(context)).toMatchObject({ level: 45 });

	const other = await context.newPage();
	await other.goto('https://www.youtube.com/watch?v=testvideo02');
	await other.evaluate(() => {
		(
			document.querySelector('#movie_player') as unknown as { setVolume(n: number): void }
		).setVolume(5);
	});
	await other.waitForTimeout(1500);
	expect(await stored(context)).toEqual({ level: 45, muted: false });
});

test('with no playback tab the controls still set the volume the next tab gets', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const first = await play(context, 'testvideo01');
	await expect(slider(panel)).toBeVisible();
	await first.close();
	await expect(panel.getByRole('button', { name: 'Resume' })).toBeVisible();

	await slider(panel).fill('22');
	await expect.poll(() => stored(context)).toMatchObject({ level: 22 });

	const next = await play(context, 'testvideo02');
	await expect.poll(() => level(next), { timeout: 4000 }).toBe(22);
});

test('the remembered volume wins when another tab starts playing', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await play(context, 'testvideo01');
	await expect(slider(panel)).toBeVisible();
	await slider(panel).fill('60');
	await expect.poll(() => stored(context)).toMatchObject({ level: 60 });

	const other = await play(context, 'testvideo02', () => {
		(window as unknown as { __volume: number }).__volume = 100;
	});
	await expect.poll(() => level(other), { timeout: 4000 }).toBe(60);
	await other.waitForTimeout(2500);
	expect(await stored(context)).toEqual({ level: 60, muted: false });
});

test('after a browser restart the panel shows the remembered volume, and the next tab gets it', async () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'audiotube-volume-'));
	const launch = () =>
		chromium.launchPersistentContext(dir, {
			channel: 'chromium',
			args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
		});
	try {
		const first = await launch();
		const id1 = new URL((await getWorker(first)).url()).host;
		const panel1 = await openPanel(first, id1);
		await play(first);
		await expect(slider(panel1)).toBeVisible();
		await slider(panel1).fill('35');
		await expect.poll(() => stored(first)).toMatchObject({ level: 35 });
		await first.close();

		const second = await launch();
		const id2 = new URL((await getWorker(second)).url()).host;
		const panel2 = await openPanel(second, id2);
		await route(second);
		await expect(panel2.getByRole('region', { name: 'Now playing' })).toBeVisible();
		await expect.poll(async () => slider(panel2).inputValue()).toBe('35');
		const page = await play(second, 'testvideo05');
		await expect.poll(() => level(page), { timeout: 4000 }).toBe(35);
		await second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

for (const width of [320, 600]) {
	test(`the controls fit at ${width} px wide and are labelled`, async ({
		context,
		extensionId
	}) => {
		const panel = await openPanel(context, extensionId);
		await play(context);
		await expect(slider(panel)).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Mute' })).toBeVisible();
		await panel.setViewportSize({ width, height: 700 });
		const overflow = await panel.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
	});
}

test('the volume slider and mute button can be reached and used from the keyboard', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	const page = await play(context);
	await expect(slider(panel)).toBeVisible();
	await slider(panel).focus();
	await panel.keyboard.press('ArrowLeft');
	await panel.keyboard.press('ArrowLeft');
	await expect.poll(() => level(page), { timeout: 1500 }).toBe(98);
	await panel.getByRole('button', { name: 'Mute' }).focus();
	await panel.keyboard.press('Enter');
	await expect.poll(() => muted(page), { timeout: 1500 }).toBe(true);
});
