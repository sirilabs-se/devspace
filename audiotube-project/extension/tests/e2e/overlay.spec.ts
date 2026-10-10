import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, expect, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const overlay = (page: Page) => page.locator('audiotube-overlay');
const panelSwitch = (page: Page) => page.getByRole('switch', { name: 'Audio only' });

async function openYouTube(context: BrowserContext, url = 'https://www.youtube.com/watch?v=test1') {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.goto(url);
	return page;
}

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(panelSwitch(page)).toBeVisible();
	return page;
}

test('covers the whole player while audio-only is on, and nothing under it can be clicked', async ({
	context
}) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);

	const box = (await page.locator('#movie_player').boundingBox())!;
	const overlayBox = (await overlay(page).boundingBox())!;
	expect(overlayBox).toEqual(box);

	// Every part of the player, including YouTube's controls and captions, is under the overlay.
	for (const selector of ['.ytp-play-button', '.ytp-caption-window-container', 'video']) {
		const target = (await page.locator(selector).boundingBox())!;
		const topmost = await page.evaluate(
			([x, y]) => document.elementFromPoint(x, y)?.tagName.toLowerCase(),
			[target.x + target.width / 2, target.y + target.height / 2]
		);
		expect(topmost, selector).toBe('audiotube-overlay');
	}

	const play = (await page.locator('.ytp-play-button').boundingBox())!;
	await page.mouse.click(play.x + play.width / 2, play.y + play.height / 2);
	expect(
		await page.evaluate(() => (window as unknown as { __playClicks: number }).__playClicks)
	).toBe(0);

	// The overlay sits inside the player element.
	expect(
		await page.evaluate(() => !!document.querySelector('#movie_player > audiotube-overlay'))
	).toBe(true);
});

test('shows the logo, the label and a Show video button', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page).getByText('Audio only')).toBeVisible();
	await expect(overlay(page).getByRole('button', { name: 'Show video' })).toBeVisible();
});

test('follows the side panel switch within 1 second', async ({ context, extensionId }) => {
	const page = await openYouTube(context);
	const panel = await openPanel(context, extensionId);
	await expect(overlay(page)).toHaveCount(1);

	await panelSwitch(panel).click();
	await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });

	await panelSwitch(panel).click();
	await expect(overlay(page)).toHaveCount(1, { timeout: 1000 });
});

test('Show video removes the overlay and the side panel switch shows off', async ({
	context,
	extensionId
}) => {
	const page = await openYouTube(context);
	const panel = await openPanel(context, extensionId);
	await overlay(page).getByRole('button', { name: 'Show video' }).click();
	await expect(overlay(page)).toHaveCount(0);
	await expect(panelSwitch(panel)).toHaveAttribute('aria-checked', 'false');
});

test('stays correct when YouTube moves to another page without a reload', async ({ context }) => {
	const page = await openYouTube(context);
	await expect(overlay(page)).toHaveCount(1);

	const navigate = (to: string) =>
		page.evaluate((p) => (window as unknown as { __navigate(p: string): void }).__navigate(p), to);

	await navigate('/watch?v=test2');
	await expect(overlay(page)).toHaveCount(1);
	await expect(page.locator('#movie_player > audiotube-overlay')).toHaveCount(1);

	await navigate('/');
	await expect(overlay(page)).toHaveCount(0);

	await navigate('/watch?v=test3');
	await expect(overlay(page)).toHaveCount(1);
});

test('is not added to pages that are not watch pages', async ({ context }) => {
	const page = await openYouTube(context, 'https://www.youtube.com/');
	await page.waitForTimeout(300);
	await expect(overlay(page)).toHaveCount(0);
});

test('does not appear when audio-only is saved as off', async ({ context }) => {
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
	await worker.evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const page = await openYouTube(context);
	await page.waitForTimeout(300);
	await expect(overlay(page)).toHaveCount(0);
});

test('the script added to an already-open YouTube tab works without a reload, and only runs once', async () => {
	// A copy of the build whose content script matches no page on its own, so the overlay can
	// only come from injecting the built script into the open tab, which is what install does.
	const dir = mkdtempSync(path.join(tmpdir(), 'audiotube-open-tab-'));
	cpSync(DIST, dir, { recursive: true });
	const manifestPath = path.join(dir, 'manifest.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	manifest.content_scripts[0].matches = ['https://never.example/*'];
	writeFileSync(manifestPath, JSON.stringify(manifest));

	const context = await chromium.launchPersistentContext('', {
		channel: 'chromium',
		args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`]
	});
	try {
		// Let the install-time injection run (and find no tab) before the YouTube tab is opened.
		const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
		await new Promise((resolve) => setTimeout(resolve, 1500));
		const page = await openYouTube(context);
		await page.waitForTimeout(500);
		await expect(overlay(page)).toHaveCount(0);

		const inject = () =>
			worker.evaluate(async () => {
				const files = chrome.runtime.getManifest().content_scripts!.flatMap((s) => s.js!);
				const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
				for (const tab of tabs)
					await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files });
			});
		await inject();
		await expect(overlay(page)).toHaveCount(1);
		await inject();
		await page.waitForTimeout(300);
		await expect(overlay(page)).toHaveCount(1);
	} finally {
		await context.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
