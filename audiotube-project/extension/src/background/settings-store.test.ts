import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAudioOnly } from './settings-store';

let stored: Map<string, unknown>;
let failWrites: boolean;
const set = vi.fn();

beforeEach(() => {
	stored = new Map([['saveBandwidth', false]]);
	failWrites = false;
	set.mockReset();
	set.mockImplementation(async (items: Record<string, unknown>) => {
		if (failWrites) throw new Error('QUOTA_BYTES quota exceeded');
		for (const [key, value] of Object.entries(items)) stored.set(key, value);
	});
	vi.stubGlobal('chrome', { storage: { local: { set } } });
});

afterEach(() => vi.unstubAllGlobals());

describe('setAudioOnly', () => {
	it('saves the value and reports success', async () => {
		expect(await setAudioOnly(false)).toEqual({ ok: true, audioOnly: false });
		expect(stored.get('audioOnly')).toBe(false);
	});

	it('writes only the audio-only key', async () => {
		await setAudioOnly(false);
		expect(set).toHaveBeenCalledWith({ audioOnly: false });
		expect(stored.get('saveBandwidth')).toBe(false);
	});

	it('refuses a value that is not a boolean and writes nothing', async () => {
		expect(await setAudioOnly('off')).toEqual({ ok: false, error: 'invalid-value' });
		expect(set).not.toHaveBeenCalled();
		expect(stored.has('audioOnly')).toBe(false);
	});

	it('reports a failed write and leaves the saved value as it was', async () => {
		stored.set('audioOnly', true);
		failWrites = true;
		expect(await setAudioOnly(false)).toEqual({ ok: false, error: 'storage-failed' });
		expect(stored.get('audioOnly')).toBe(true);
	});
});
