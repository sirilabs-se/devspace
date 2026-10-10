import { describe, expect, it } from 'vitest';
import { isVolumeLevel, parseVolume } from './volume';

describe('isVolumeLevel', () => {
	it('accepts whole numbers from 0 to 100', () => {
		expect(isVolumeLevel(0)).toBe(true);
		expect(isVolumeLevel(100)).toBe(true);
		expect(isVolumeLevel(55)).toBe(true);
		expect(isVolumeLevel(101)).toBe(false);
		expect(isVolumeLevel(-1)).toBe(false);
		expect(isVolumeLevel(50.5)).toBe(false);
		expect(isVolumeLevel('50')).toBe(false);
	});
});

describe('parseVolume', () => {
	it('reads a valid value', () => {
		expect(parseVolume({ level: 40, muted: true })).toEqual({ level: 40, muted: true });
		expect(parseVolume({ level: 0, muted: false })).toEqual({ level: 0, muted: false });
	});

	it('reads a missing muted flag as not muted', () => {
		expect(parseVolume({ level: 70 })).toEqual({ level: 70, muted: false });
	});

	it('reads anything missing or invalid as not known', () => {
		expect(parseVolume(undefined)).toBeNull();
		expect(parseVolume('loud')).toBeNull();
		expect(parseVolume({ level: 300, muted: false })).toBeNull();
		expect(parseVolume({ muted: true })).toBeNull();
	});
});
