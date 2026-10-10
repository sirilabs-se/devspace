import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PANEL = (id: string) => `chrome-extension://${id}/src/sidepanel/index.html`;

async function openPanel(context: BrowserContext, extensionId: string): Promise<Page> {
	const page = await context.newPage();
	await page.goto(PANEL(extensionId));
	return page;
}

const toggle = (page: Page) => page.getByRole('switch', { name: 'Audio only' });

async function worker(context: BrowserContext) {
	return context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
}

test('shows on for a fresh install, and the saved value when the panel opens', async ({
	context,
	extensionId
}) => {
	const page = await openPanel(context, extensionId);
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');

	await (await worker(context)).evaluate(() => chrome.storage.local.set({ audioOnly: false }));
	const reopened = await openPanel(context, extensionId);
	await expect(toggle(reopened)).toHaveAttribute('aria-checked', 'false');
});

test('turning the switch saves the new value', async ({ context, extensionId }) => {
	const page = await openPanel(context, extensionId);
	await toggle(page).click();
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
	await expect(page.getByText('Video visible on the YouTube tab')).toBeVisible();
	const stored = await (
		await worker(context)
	).evaluate(() => chrome.storage.local.get('audioOnly'));
	expect(stored).toEqual({ audioOnly: false });
});

test('a change in one window shows in another within 1 second', async ({
	context,
	extensionId
}) => {
	const first = await openPanel(context, extensionId);
	const second = await openPanel(context, extensionId);
	await expect(toggle(second)).toHaveAttribute('aria-checked', 'true');
	await toggle(first).click();
	await expect(toggle(second)).toHaveAttribute('aria-checked', 'false', { timeout: 1000 });
});

test('when saving fails the switch goes back and a message appears', async ({
	context,
	extensionId
}) => {
	const page = await openPanel(context, extensionId);
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
	await (
		await worker(context)
	).evaluate(async () => {
		const used = await chrome.storage.local.getBytesInUse();
		const key = 'filler';
		await chrome.storage.local.set({
			[key]: 'x'.repeat(chrome.storage.local.QUOTA_BYTES - used - key.length - 2)
		});
	});
	await toggle(page).click();
	await expect(page.getByRole('alert')).toContainText("Couldn't save that change");
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
});

test('works from the keyboard and is announced as a switch', async ({ context, extensionId }) => {
	const page = await openPanel(context, extensionId);
	await expect(toggle(page)).toBeVisible();
	await page.keyboard.press('Tab');
	await expect(toggle(page)).toBeFocused();
	await page.keyboard.press('Space');
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
	await page.keyboard.press('Enter');
	await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
});

for (const width of [320, 420, 600]) {
	test(`is usable at ${width} px wide`, async ({ context, extensionId }) => {
		const page = await openPanel(context, extensionId);
		await page.setViewportSize({ width, height: 700 });
		await expect(toggle(page)).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
		const box = await toggle(page).boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(width);
	});
}

test('follows the system light or dark setting', async ({ context, extensionId }) => {
	const page = await openPanel(context, extensionId);
	const background = () =>
		page.evaluate(() => getComputedStyle(document.querySelector('#app > div')!).backgroundColor);
	await page.emulateMedia({ colorScheme: 'light' });
	const light = await background();
	await page.emulateMedia({ colorScheme: 'dark' });
	const dark = await background();
	expect(light).not.toBe(dark);
});
