import { describe, expect, it } from 'vitest';
import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
	it('keeps a plain path inside the app', () => {
		expect(safeNextPath('/settings/profile')).toBe('/settings/profile');
		expect(safeNextPath('/admin/users?q=anna')).toBe('/admin/users?q=anna');
	});

	it('falls back to the home page for anything that could leave the app', () => {
		for (const next of [
			null,
			undefined,
			'',
			'https://evil.example',
			'//evil.example',
			'/\\evil.example',
			'javascript:alert(1)',
			'settings',
			'/ok\nSet-Cookie: x=1'
		]) {
			expect(safeNextPath(next), String(next)).toBe('/');
		}
	});

	it('never sends someone back to the login page', () => {
		expect(safeNextPath('/login')).toBe('/');
		expect(safeNextPath('/login?next=/login')).toBe('/');
		expect(safeNextPath('/login/two-step')).toBe('/');
	});
});
