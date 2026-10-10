import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isValidSettingValue, parseSettings } from './schema';

describe('parseSettings', () => {
	it('reads everything as on when nothing is saved', () => {
		expect(parseSettings(undefined)).toEqual({ audioOnly: true, saveBandwidth: true });
		expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps saved values that are valid', () => {
		expect(parseSettings({ audioOnly: false, saveBandwidth: false })).toEqual({
			audioOnly: false,
			saveBandwidth: false
		});
	});

	it('falls back to the default for an invalid value without touching the other setting', () => {
		expect(parseSettings({ audioOnly: 'banana', saveBandwidth: false })).toEqual({
			audioOnly: true,
			saveBandwidth: false
		});
		expect(parseSettings({ audioOnly: false, saveBandwidth: 0 })).toEqual({
			audioOnly: false,
			saveBandwidth: true
		});
		expect(parseSettings({ audioOnly: null, saveBandwidth: {} })).toEqual(DEFAULT_SETTINGS);
	});

	it('ignores keys that are not settings', () => {
		expect(parseSettings({ somethingElse: false })).toEqual(DEFAULT_SETTINGS);
	});
});

describe('isValidSettingValue', () => {
	it('accepts only booleans', () => {
		expect(isValidSettingValue('audioOnly', true)).toBe(true);
		expect(isValidSettingValue('audioOnly', false)).toBe(true);
		expect(isValidSettingValue('audioOnly', 'on')).toBe(false);
		expect(isValidSettingValue('audioOnly', 1)).toBe(false);
		expect(isValidSettingValue('audioOnly', undefined)).toBe(false);
	});
});
