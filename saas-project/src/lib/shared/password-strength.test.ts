import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
	it('is 0 for an empty password', () => {
		expect(passwordStrength('')).toBe(0);
	});

	it('is 1 for anything under 10 characters', () => {
		expect(passwordStrength('Ab1!Ab1!x')).toBe(1);
	});

	it('is 2 for 10 characters of one kind', () => {
		expect(passwordStrength('abcdefghij')).toBe(2);
	});

	it('is 2 for a long run of repeated characters', () => {
		expect(passwordStrength('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(2);
	});

	it('is 3 for a mix of three kinds', () => {
		expect(passwordStrength('Abcdefgh12')).toBe(3);
	});

	it('is 4 for a long mixed password or a very long one', () => {
		expect(passwordStrength('Correct-Horse-42-Battery')).toBe(4);
		expect(passwordStrength('correct horse battery staple')).toBe(4);
	});
});
