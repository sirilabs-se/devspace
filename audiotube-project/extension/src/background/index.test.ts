import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('background start-up', () => {
	it('adds the content script to open YouTube tabs when the extension is installed or updated', async () => {
		let onInstalled: (() => void) | undefined;
		const query = vi.fn().mockResolvedValue([{ id: 7 }]);
		const executeScript = vi.fn().mockResolvedValue([]);
		vi.stubGlobal('chrome', {
			runtime: {
				id: 'ext',
				onMessage: { addListener: vi.fn() },
				onInstalled: { addListener: (listener: () => void) => (onInstalled = listener) },
				getManifest: () => ({ content_scripts: [{ js: ['src/content/index.js'] }] })
			},
			sidePanel: { setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
			tabs: { query },
			scripting: { executeScript }
		});

		await import('./index');
		expect(onInstalled).toBeTypeOf('function');
		onInstalled!();
		await vi.waitFor(() =>
			expect(executeScript).toHaveBeenCalledWith({
				target: { tabId: 7 },
				files: ['src/content/index.js']
			})
		);
	});
});
