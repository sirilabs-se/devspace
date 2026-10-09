import { describe, expect, it } from 'vitest';
import { passwordChecklist } from '$lib/shared/password-checklist';
import { passwordProblem } from './password';

describe('passwordProblem', () => {
	it('accepts 8+ characters with upper case, lower case, a number and a special character', () => {
		expect(passwordProblem('Abcdef1!')).toBeNull();
		expect(passwordProblem('Correct-Horse-42')).toBeNull();
		expect(passwordProblem('Ärligt9#lösen')).toBeNull();
	});

	it('refuses a password missing any one part of the rule', () => {
		expect(passwordProblem('Abcde1!')).toBe('too_weak'); // 7 characters
		expect(passwordProblem('abcdefg1!')).toBe('too_weak'); // no upper case
		expect(passwordProblem('ABCDEFG1!')).toBe('too_weak'); // no lower case
		expect(passwordProblem('Abcdefgh!')).toBe('too_weak'); // no number
		expect(passwordProblem('Abcdefgh1')).toBe('too_weak'); // no special character
	});

	it('does not count a space as a special character', () => {
		expect(passwordProblem('Abcdefg 1')).toBe('too_weak');
	});

	it('refuses an empty password and one over 128 characters', () => {
		expect(passwordProblem('')).toBe('too_weak');
		expect(passwordProblem('Aa1!' + 'x'.repeat(125))).toBe('too_long');
	});

	it('agrees with the checklist the sign-up page shows while typing', () => {
		const samples = [
			'',
			'Abcde1!',
			'Abcdef1!',
			'abcdefg1!',
			'ABCDEFG1!',
			'Abcdefgh!',
			'Abcdefgh1',
			'Abcdefg 1',
			'Correct-Horse-42',
			'Ärligt9#lösen'
		];

		for (const password of samples) {
			const allMet = passwordChecklist(password).every((check) => check.met);
			expect(allMet, `"${password}"`).toBe(passwordProblem(password) === null);
		}
	});
});
