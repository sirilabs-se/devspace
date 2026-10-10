import { describe, expect, it } from 'vitest';
import { manifest } from './manifest.config.ts';

describe('manifest', () => {
	it('asks for exactly the approved permissions and nothing else', () => {
		expect([...manifest.permissions].sort()).toEqual(['scripting', 'sidePanel', 'storage']);
		expect(manifest.host_permissions).toEqual(['https://www.youtube.com/*']);
		expect('optional_permissions' in manifest).toBe(false);
		expect('optional_host_permissions' in manifest).toBe(false);
	});

	it('requires Chrome 116 or newer, the first with the side panel API', () => {
		expect(manifest.minimum_chrome_version).toBe('116');
	});

	it('declares icons at their real sizes', () => {
		expect(Object.keys(manifest.icons).sort()).toEqual(['128', '16', '48']);
	});
});
