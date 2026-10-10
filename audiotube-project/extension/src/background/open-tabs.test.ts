import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectIntoOpenTabs } from './open-tabs';

const query = vi.fn();
const executeScript = vi.fn();
let contentScripts: { js?: string[]; world?: string }[] | undefined;

beforeEach(() => {
	contentScripts = [{ js: ['src/content/index.js'] }];
	query.mockReset();
	executeScript.mockReset();
	executeScript.mockResolvedValue([]);
	vi.stubGlobal('chrome', {
		runtime: { getManifest: () => ({ content_scripts: contentScripts }) },
		tabs: { query },
		scripting: { executeScript }
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('injectIntoOpenTabs', () => {
	it('adds the content script to every open YouTube tab', async () => {
		query.mockResolvedValue([{ id: 3 }, { id: 9 }]);
		await injectIntoOpenTabs();
		expect(query).toHaveBeenCalledWith({ url: 'https://www.youtube.com/*' });
		expect(executeScript).toHaveBeenCalledTimes(2);
		expect(executeScript).toHaveBeenCalledWith({
			target: { tabId: 3 },
			files: ['src/content/index.js']
		});
		expect(executeScript).toHaveBeenCalledWith({
			target: { tabId: 9 },
			files: ['src/content/index.js']
		});
	});

	it('carries on when one tab cannot be injected', async () => {
		query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
		executeScript.mockRejectedValueOnce(new Error('Cannot access a chrome:// URL'));
		await expect(injectIntoOpenTabs()).resolves.toBeUndefined();
		expect(executeScript).toHaveBeenCalledTimes(2);
	});

	it('adds each content script to its own world', async () => {
		contentScripts = [
			{ js: ['src/content/index.js'] },
			{ js: ['src/inject/index.js'], world: 'MAIN' }
		];
		query.mockResolvedValue([{ id: 4 }]);
		await injectIntoOpenTabs();
		expect(executeScript).toHaveBeenCalledWith({
			target: { tabId: 4 },
			files: ['src/content/index.js']
		});
		expect(executeScript).toHaveBeenCalledWith({
			target: { tabId: 4 },
			files: ['src/inject/index.js'],
			world: 'MAIN'
		});
	});

	it('skips tabs without an id and does nothing when there is no content script', async () => {
		query.mockResolvedValue([{}]);
		await injectIntoOpenTabs();
		expect(executeScript).not.toHaveBeenCalled();

		contentScripts = undefined;
		await injectIntoOpenTabs();
		expect(query).toHaveBeenCalledTimes(1);
	});
});
