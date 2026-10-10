import { describe, expect, it, vi } from 'vitest';
import {
	createQualityManager,
	levelFromPreference,
	lowestLevel,
	PREFERENCE_KEY,
	PREVIOUS_KEY,
	type KeyValueStore,
	type PlayerApi
} from './quality';

const preference = (quality: number) =>
	JSON.stringify({ data: JSON.stringify({ quality, previousQuality: 0 }), creation: 1 });

function fakeStore(
	initial: Record<string, string> = {}
): KeyValueStore & { data: Map<string, string> } {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function fakePlayer(levels: unknown = ['hd1080', 'hd720', 'large', 'small', 'tiny', 'auto']) {
	const setPlaybackQualityRange = vi.fn<(min: string, max?: string) => void>();
	const player: PlayerApi = { getAvailableQualityLevels: () => levels, setPlaybackQualityRange };
	return { player, setPlaybackQualityRange };
}

describe('levelFromPreference', () => {
	it('maps the stored height to a level name', () => {
		expect(levelFromPreference(preference(720))).toBe('hd720');
		expect(levelFromPreference(preference(144))).toBe('tiny');
		expect(levelFromPreference(preference(2160))).toBe('hd2160');
	});

	it('reads Auto, a missing value and anything unreadable as auto', () => {
		expect(levelFromPreference(preference(0))).toBe('auto');
		expect(levelFromPreference(null)).toBe('auto');
		expect(levelFromPreference('not json')).toBe('auto');
		expect(levelFromPreference(JSON.stringify({ data: 'nope' }))).toBe('auto');
		expect(levelFromPreference(preference(999))).toBe('auto');
	});
});

describe('lowestLevel', () => {
	it('is the last level that is not auto', () => {
		expect(lowestLevel(['hd720', 'large', 'tiny', 'auto'])).toBe('tiny');
		expect(lowestLevel(['hd1080', 'hd720', 'auto'])).toBe('hd720');
	});

	it('is nothing when there are no levels', () => {
		expect(lowestLevel([])).toBeNull();
		expect(lowestLevel(['auto'])).toBeNull();
		expect(lowestLevel(undefined)).toBeNull();
		expect(lowestLevel('tiny')).toBeNull();
	});
});

describe('createQualityManager', () => {
	it('asks for the lowest level and remembers what the user had', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(720) });
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		expect(manager.applyLowest()).toBe('done');
		expect(setPlaybackQualityRange).toHaveBeenCalledWith('tiny', 'tiny');
		expect(store.getItem(PREVIOUS_KEY)).toBe('hd720');
	});

	it('does not overwrite the remembered choice when asked again', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(720) });
		const { player } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		manager.applyLowest();
		store.setItem(PREFERENCE_KEY, preference(144));
		manager.applyLowest();
		expect(store.getItem(PREVIOUS_KEY)).toBe('hd720');
	});

	it('puts back the remembered level and forgets it', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(720) });
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		manager.applyLowest();
		setPlaybackQualityRange.mockClear();
		expect(manager.restore()).toBe('done');
		expect(setPlaybackQualityRange).toHaveBeenCalledWith('hd720', 'hd720');
		expect(store.getItem(PREVIOUS_KEY)).toBeNull();
	});

	it('puts back Auto when the user had Auto', () => {
		const store = fakeStore();
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		manager.applyLowest();
		setPlaybackQualityRange.mockClear();
		manager.restore();
		expect(setPlaybackQualityRange).toHaveBeenCalledWith('auto');
	});

	it('restores a choice remembered before a reload', () => {
		const store = fakeStore({ [PREVIOUS_KEY]: 'hd1080', [PREFERENCE_KEY]: preference(144) });
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		manager.restore();
		expect(setPlaybackQualityRange).toHaveBeenCalledWith('hd1080', 'hd1080');
	});

	it('does nothing on restore when it never changed anything', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(480) });
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		expect(manager.restore()).toBe('done');
		expect(setPlaybackQualityRange).not.toHaveBeenCalled();
	});

	it('restores the current preference in another tab that already changed its own player', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(720) });
		const { player, setPlaybackQualityRange } = fakePlayer();
		const manager = createQualityManager({ player: () => player, store });
		manager.applyLowest();
		// Another tab restored first, so the remembered choice is gone and the preference is back.
		store.removeItem(PREVIOUS_KEY);
		store.setItem(PREFERENCE_KEY, preference(720));
		setPlaybackQualityRange.mockClear();
		manager.restore();
		expect(setPlaybackQualityRange).toHaveBeenCalledWith('hd720', 'hd720');
	});

	it('reports unavailable, and changes nothing, when there is no player or no levels', () => {
		const store = fakeStore({ [PREFERENCE_KEY]: preference(720) });
		expect(createQualityManager({ player: () => null, store }).applyLowest()).toBe('unavailable');
		const empty = fakePlayer([]);
		expect(createQualityManager({ player: () => empty.player, store }).applyLowest()).toBe(
			'unavailable'
		);
		expect(createQualityManager({ player: () => ({}), store }).applyLowest()).toBe('unavailable');
		expect(empty.setPlaybackQualityRange).not.toHaveBeenCalled();
	});

	it('survives a player that throws', () => {
		const store = fakeStore();
		const throwing: PlayerApi = {
			getAvailableQualityLevels: () => ['hd720', 'tiny', 'auto'],
			setPlaybackQualityRange: () => {
				throw new Error('refused');
			}
		};
		const manager = createQualityManager({ player: () => throwing, store });
		expect(manager.applyLowest()).toBe('unavailable');
		// The remembered choice is kept, so a later restore can still put it back.
		expect(manager.restore()).toBe('unavailable');
		expect(store.getItem(PREVIOUS_KEY)).toBe('auto');
		const brokenLevels: PlayerApi = {
			getAvailableQualityLevels: () => {
				throw new Error('not ready');
			},
			setPlaybackQualityRange: vi.fn()
		};
		expect(createQualityManager({ player: () => brokenLevels, store }).applyLowest()).toBe(
			'unavailable'
		);
	});
});
