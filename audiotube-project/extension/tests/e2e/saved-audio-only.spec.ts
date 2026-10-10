import { chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DIST, expect, getWorker, test } from './fixtures';

async function launch(userDataDir: string): Promise<BrowserContext> {
	return chromium.launchPersistentContext(userDataDir, {
		channel: 'chromium',
		args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
	});
}

async function worker(context: BrowserContext): Promise<Worker> {
	return getWorker(context);
}

async function sendFromPage(context: BrowserContext, value: unknown) {
	const extensionId = new URL((await worker(context)).url()).host;
	const page = await context.newPage();
	await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
	const response = await page.evaluate(
		(v) => chrome.runtime.sendMessage({ type: 'settings/set-audio-only', value: v }),
		value
	);
	await page.close();
	return response;
}

async function stored(context: BrowserContext) {
	return (await worker(context)).evaluate(() =>
		chrome.storage.local.get(['audioOnly', 'saveBandwidth'])
	);
}

test('nothing is stored on a fresh install, so audio-only reads as its default', async ({
	context
}) => {
	expect(await stored(context)).toEqual({});
});

test('a request saves audio-only and it is still off after the browser restarts', async () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'audiotube-'));
	try {
		const first = await launch(dir);
		expect(await sendFromPage(first, false)).toEqual({ ok: true, audioOnly: false });
		expect(await stored(first)).toEqual({ audioOnly: false });
		await first.close();

		const second = await launch(dir);
		expect(await stored(second)).toEqual({ audioOnly: false });
		await second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('a request with an invalid value is refused and nothing is saved', async ({ context }) => {
	expect(await sendFromPage(context, 'banana')).toEqual({ ok: false, error: 'invalid-value' });
	expect(await stored(context)).toEqual({});
});

test('when storage is full the write fails, the caller gets an error, and the value is unchanged', async ({
	context
}) => {
	expect(await sendFromPage(context, true)).toEqual({ ok: true, audioOnly: true });
	await (
		await worker(context)
	).evaluate(async () => {
		const quota = chrome.storage.local.QUOTA_BYTES;
		const used = await chrome.storage.local.getBytesInUse();
		const key = 'filler';
		// Fill to exactly the quota (key + JSON string quotes), so one more byte cannot fit.
		await chrome.storage.local.set({ [key]: 'x'.repeat(quota - used - key.length - 2) });
	});
	expect(await sendFromPage(context, false)).toEqual({ ok: false, error: 'storage-failed' });
	expect(await stored(context)).toEqual({ audioOnly: true });
});
