import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '../shared';
import { OWNER_ATTRIBUTE, startVisibilityFlag, VISIBLE_ATTRIBUTE } from './visibility';

/** The few parts of an element the flag uses. */
function fakeRoot() {
	const attributes = new Map<string, string>();
	return {
		attributes,
		setAttribute: (name: string, value: string) => void attributes.set(name, value),
		removeAttribute: (name: string) => void attributes.delete(name),
		getAttribute: (name: string) => attributes.get(name) ?? null
	} as unknown as HTMLElement & { attributes: Map<string, string> };
}

function setup(audioOnly = true, id = 'copy-1', root = fakeRoot()) {
	let change!: (settings: Settings) => void;
	const stop = startVisibilityFlag(
		{
			read: async () => ({ audioOnly, saveBandwidth: true }),
			watch: (listener) => {
				change = listener;
				return () => {};
			}
		},
		root,
		id
	);
	return {
		root,
		stop,
		change: (value: boolean) => change({ audioOnly: value, saveBandwidth: true })
	};
}

describe('startVisibilityFlag', () => {
	it('marks the page with its own id and has no visible flag while audio-only is on', async () => {
		const { root } = setup(true);
		await vi.waitFor(() => expect(root.getAttribute(OWNER_ATTRIBUTE)).toBe('copy-1'));
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBeNull();
	});

	it('sets the flag while audio-only is off and removes it when it turns on', () => {
		const { root, change } = setup();
		change(false);
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBe('');
		change(true);
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBeNull();
	});

	it('when cut off while still the newest, sets the flag so the picture shows', () => {
		const { root, stop } = setup();
		stop();
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBe('');
		expect(root.getAttribute(OWNER_ATTRIBUTE)).toBeNull();
	});

	it('when a newer copy has taken over, leaves what the newer copy set alone', () => {
		const root = fakeRoot();
		const older = setup(true, 'older', root);
		const newer = setup(false, 'newer', root);
		newer.change(false);
		expect(root.getAttribute(OWNER_ATTRIBUTE)).toBe('newer');
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBe('');

		older.stop();
		expect(root.getAttribute(OWNER_ATTRIBUTE)).toBe('newer');
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBe('');
	});

	it('does not remove a flag the newer copy chose to clear', () => {
		const root = fakeRoot();
		const older = setup(false, 'older', root);
		const newer = setup(true, 'newer', root);
		newer.change(true);
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBeNull();
		older.stop();
		expect(root.getAttribute(VISIBLE_ATTRIBUTE)).toBeNull();
	});
});
