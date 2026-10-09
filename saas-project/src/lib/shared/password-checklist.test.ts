import { describe, expect, it } from 'vitest';
import { passwordChecklist } from './password-checklist';

const met = (password: string) =>
	Object.fromEntries(passwordChecklist(password).map((check) => [check.id, check.met]));

describe('passwordChecklist', () => {
	it('marks nothing as met for an empty password', () => {
		expect(met('')).toEqual({ length: false, case: false, number: false, special: false });
	});

	it('marks each part of the rule as it is met', () => {
		expect(met('abcdefgh')).toEqual({ length: true, case: false, number: false, special: false });
		expect(met('Ab')).toEqual({ length: false, case: true, number: false, special: false });
		expect(met('7')).toEqual({ length: false, case: false, number: true, special: false });
		expect(met('!')).toEqual({ length: false, case: false, number: false, special: true });
	});

	it('marks everything as met for a password that follows the rule', () => {
		expect(met('Abcdef1!')).toEqual({ length: true, case: true, number: true, special: true });
	});
});
