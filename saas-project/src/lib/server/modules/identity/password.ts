export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The password rule: at least 8 characters, with an upper case letter, a
 * lower case letter, a number and a special character.
 */
export function passwordProblem(password: string): 'too_weak' | 'too_long' | null {
	if (password.length > PASSWORD_MAX_LENGTH) return 'too_long';

	const strongEnough =
		password.length >= PASSWORD_MIN_LENGTH &&
		/\p{Lu}/u.test(password) &&
		/\p{Ll}/u.test(password) &&
		/\p{Nd}/u.test(password) &&
		/[^\p{L}\p{N}\s]/u.test(password);

	return strongEnough ? null : 'too_weak';
}
