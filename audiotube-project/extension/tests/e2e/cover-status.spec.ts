import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, getWorker, test } from './fixtures';

const FIXTURE = readFileSync(path.resolve('tests/fixtures/youtube.html'), 'utf8');
const MESSAGE = "Couldn't cover YouTube's player on this page";

async function openPanel(context: BrowserContext, extensionId: string) {
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	await expect(page.getByRole('switch', { name: 'Audio only' })).toBeVisible();
	return page;
}

/** Opened after the panel, so the YouTube tab is the one being looked at in that window. */
async function openYouTubeWithoutPlayer(context: BrowserContext) {
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page = await context.newPage();
	await page.addInitScript(() => {
		(window as unknown as { __noPlayer: boolean }).__noPlayer = true;
	});
	await page.goto('https://www.youtube.com/watch?v=test1');
	return page;
}

const storedStatuses = async (context: BrowserContext) => {
	const worker = await getWorker(context);
	return worker.evaluate(async () =>
		Object.keys(await chrome.storage.session.get(null)).filter((k) =>
			k.startsWith('overlayStatus:')
		)
	);
};

test('says it could not cover the player, and audio-only stays on', async ({
	context,
	extensionId
}) => {
	const panel = await openPanel(context, extensionId);
	await expect(panel.getByText(MESSAGE)).toHaveCount(0);

	const page = await openYouTubeWithoutPlayer(context);
	await expect(panel.getByText(MESSAGE)).toBeVisible({ timeout: 7000 });

	const worker = await getWorker(context);
	const stored = await worker.evaluate(() => chrome.storage.local.get('audioOnly'));
	expect(stored.audioOnly ?? true).toBe(true);
	await expect(panel.getByRole('switch', { name: 'Audio only' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(page.locator('audiotube-overlay')).toHaveCount(0);
});

test('the message goes when the player appears later', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	const page = await openYouTubeWithoutPlayer(context);
	await expect(panel.getByText(MESSAGE)).toBeVisible({ timeout: 7000 });

	await page.evaluate(() => (window as unknown as { __addPlayer(): void }).__addPlayer());
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await expect(panel.getByText(MESSAGE)).toHaveCount(0);
});

test('closing the tab clears its status and the message', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	const page = await openYouTubeWithoutPlayer(context);
	await expect(panel.getByText(MESSAGE)).toBeVisible({ timeout: 7000 });
	expect(await storedStatuses(context)).toHaveLength(1);

	await page.close();
	await expect.poll(() => storedStatuses(context)).toHaveLength(0);
	await expect(panel.getByText(MESSAGE)).toHaveCount(0);
});

test('a page whose player is found never shows the message', async ({ context, extensionId }) => {
	const panel = await openPanel(context, extensionId);
	await context.route('https://www.youtube.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: FIXTURE })
	);
	const page: Page = await context.newPage();
	await page.goto('https://www.youtube.com/watch?v=test1');
	await expect(page.locator('audiotube-overlay')).toHaveCount(1);
	await page.waitForTimeout(6000);
	await expect(panel.getByText(MESSAGE)).toHaveCount(0);
});
