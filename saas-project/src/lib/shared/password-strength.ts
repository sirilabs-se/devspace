/** 0 is empty, 1 is too short to be accepted, 4 is the strongest. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_MIN_LENGTH = 10;

/**
 * A rough guide to how strong a password is, for the strength meter.
 * Guidance only: the server decides whether a password is accepted.
 */
export function passwordStrength(password: string): PasswordStrength {
	if (password.length === 0) return 0;
	if (password.length < PASSWORD_MIN_LENGTH) return 1;

	const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((kind) =>
		kind.test(password)
	).length;
	const distinct = new Set(password).size;

	// A long run of a few repeated characters is weak however long it is.
	if (distinct < 5) return 2;
	if (password.length >= 20 || (password.length >= 16 && kinds >= 3)) return 4;
	if (password.length >= 14 || kinds >= 3) return 3;
	return 2;
}
