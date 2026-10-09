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

const LABELS: Record<PasswordCheck['id'], string> = {
	length: '8+ characters',
	case: 'Upper & lowercase',
	number: 'A number',
	special: 'A special character'
};
const SUMMARIES = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'];

/** The checklist with its wording, ready to show beside a new-password field. */
export function describePassword(password: string): {
	summary: string;
	rules: { label: string; met: boolean }[];
} {
	const rules = passwordChecklist(password).map((check) => ({
		label: LABELS[check.id],
		met: check.met
	}));
	const met = rules.filter((rule) => rule.met).length;
	return { summary: SUMMARIES[password === '' ? 0 : Math.max(1, met)], rules };
}

export const PASSWORD_RULE_MESSAGE =
	'Use 8+ characters with upper and lowercase letters, a number and a special character.';
