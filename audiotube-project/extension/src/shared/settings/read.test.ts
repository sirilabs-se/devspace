import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSettings, watchSettings } from './read';

type ChangeListener = (changes: Record<string, unknown>, area: string) => void;

function installFakeChrome(initial: Record<string, unknown> = {}) {
	const stored = new Map(Object.entries(initial));
	const listeners = new Set<ChangeListener>();
	vi.stubGlobal('chrome', {
		storage: {
			local: {
				get: async (keys: string[]) =>
					Object.fromEntries(keys.filter((key) => stored.has(key)).map((k) => [k, stored.get(k)]))
			},
			onChanged: {
				addListener: (l: ChangeListener) => listeners.add(l),
				removeListener: (l: ChangeListener) => listeners.delete(l)
			}
		}
	});
	return {
		change(key: string, value: unknown, area = 'local') {
			stored.set(key, value);
			for (const l of listeners) l({ [key]: { newValue: value } }, area);
		},
		listenerCount: () => listeners.size
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('readSettings', () => {
	it('reads as on on a fresh install', async () => {
		installFakeChrome();
		expect(await readSettings()).toEqual({ audioOnly: true, saveBandwidth: true });
	});

	it('returns a saved off value', async () => {
		installFakeChrome({ audioOnly: false });
		expect(await readSettings()).toEqual({ audioOnly: false, saveBandwidth: true });
	});

	it('reads an invalid audio-only value as on and leaves saveBandwidth alone', async () => {
		installFakeChrome({ audioOnly: 'nope', saveBandwidth: false });
		expect(await readSettings()).toEqual({ audioOnly: true, saveBandwidth: false });
	});
});

describe('watchSettings', () => {
	let fake: ReturnType<typeof installFakeChrome>;
	beforeEach(() => {
		fake = installFakeChrome();
	});

	it('reports the full current settings when a saved value changes', async () => {
		const listener = vi.fn();
		watchSettings(listener);
		fake.change('audioOnly', false);
		await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
		expect(listener).toHaveBeenCalledWith({ audioOnly: false, saveBandwidth: true });
	});

	it('ignores other storage areas and other keys', async () => {
		const listener = vi.fn();
		watchSettings(listener);
		fake.change('audioOnly', false, 'sync');
		fake.change('unrelated', 1);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(listener).not.toHaveBeenCalled();
	});

	it('stops listening when the returned function is called', () => {
		const stop = watchSettings(() => {});
		expect(fake.listenerCount()).toBe(1);
		stop();
		expect(fake.listenerCount()).toBe(0);
	});
});
