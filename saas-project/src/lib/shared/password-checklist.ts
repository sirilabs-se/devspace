export type PasswordCheck = {
	id: 'length' | 'case' | 'number' | 'special';
	met: boolean;
};

/**
 * Which parts of the password rule a password meets, for the checklist shown
 * while typing. Guidance only: the server decides whether a password is accepted.
 */
export function passwordChecklist(password: string): PasswordCheck[] {
	return [
		{ id: 'length', met: password.length >= 8 },
		{ id: 'case', met: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) },
		{ id: 'number', met: /\p{Nd}/u.test(password) },
		{ id: 'special', met: /[^\p{L}\p{N}\s]/u.test(password) }
	];
}
