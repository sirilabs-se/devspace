import { afterEach, describe, expect, it, vi } from 'vitest';
import { isExtensionAlive } from './lifecycle';

afterEach(() => vi.unstubAllGlobals());

describe('isExtensionAlive', () => {
	it('is true while the extension can be reached', () => {
		vi.stubGlobal('chrome', { runtime: { id: 'abc' } });
		expect(isExtensionAlive()).toBe(true);
	});

	it('is false once the extension id is gone', () => {
		vi.stubGlobal('chrome', { runtime: { id: undefined } });
		expect(isExtensionAlive()).toBe(false);
		vi.stubGlobal('chrome', {});
		expect(isExtensionAlive()).toBe(false);
	});

	it('is false when reading it throws', () => {
		vi.stubGlobal('chrome', {
			get runtime(): never {
				throw new Error('Extension context invalidated.');
			}
		});
		expect(isExtensionAlive()).toBe(false);
	});
});
