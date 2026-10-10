import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { DIST, expect, test } from './fixtures';

function filesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? filesUnder(full) : [full];
	});
}

test('the extension loads and its service worker starts', async ({ context }) => {
	const [worker] = context.serviceWorkers().length
		? context.serviceWorkers()
		: [await context.waitForEvent('serviceworker')];
	const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
	expect(manifest.name).toBe('AudioTube');
	expect(manifest.minimum_chrome_version).toBe('116');
});

test('clicking the toolbar icon is set to open the side panel', async ({ context }) => {
	const [worker] = context.serviceWorkers().length
		? context.serviceWorkers()
		: [await context.waitForEvent('serviceworker')];
	await expect
		.poll(() => worker.evaluate(() => chrome.sidePanel.getPanelBehavior()))
		.toEqual({ openPanelOnActionClick: true });
});

test('the side panel page is empty and error-free', async ({ context, extensionId }) => {
	const errors: string[] = [];
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	const main = page.locator('#app > main');
	await expect(main).toBeAttached();
	await expect(main).toBeEmpty();
	expect(errors).toEqual([]);
});

test('the build output contains nothing from the prototype', () => {
	const files = filesUnder(DIST);
	expect(files.filter((file) => file.includes('_prototype'))).toEqual([]);
	const mentions = files
		.filter((f) => /\.(js|css|html|json)$/.test(f))
		.filter((f) => readFileSync(f, 'utf8').includes('_prototype/'));
	expect(mentions).toEqual([]);
});

test("Tailwind's default colours are not in the build", () => {
	const css = filesUnder(DIST)
		.filter((file) => file.endsWith('.css'))
		.map((file) => readFileSync(file, 'utf8'))
		.join('\n');
	expect(css).not.toMatch(/--color-(red|blue|green|gray|slate)-\d{2,3}/);
});
