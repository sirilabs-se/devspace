import { sendEmail } from '$lib/server/email';

const APP_NAME = 'SaaS';

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Confirm your email for ${APP_NAME}`,
		text: [
			`Welcome to ${APP_NAME}.`,
			'',
			'Open this link to confirm your email address. It works for 24 hours.',
			verifyUrl,
			'',
			"If you didn't create an account, you can ignore this email."
		].join('\n')
	});
}

/** Sent to the owner when someone tries to register with an email that already has an account. */
export async function sendExistingAccountEmail(to: string, origin: string): Promise<void> {
	await sendEmail({
		to,
		subject: `You already have a ${APP_NAME} account`,
		text: [
			`Someone tried to create a ${APP_NAME} account with this email address, but it already has one.`,
			'',
			`If that was you, sign in here: ${origin}/login`,
			`If you forgot your password, reset it here: ${origin}/forgot-password`,
			'',
			"If it wasn't you, you can ignore this email. Your account is unchanged."
		].join('\n')
	});
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Reset your ${APP_NAME} password`,
		text: [
			`Someone asked to reset the password for your ${APP_NAME} account.`,
			'',
			'Open this link to choose a new password. It works once, for 1 hour.',
			resetUrl,
			'',
			"If it wasn't you, you can ignore this email. Your password is unchanged."
		].join('\n')
	});
}

export async function sendPasswordChangedEmail(to: string, origin: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} password was changed`,
		text: [
			`The password for your ${APP_NAME} account was just changed, and every device was signed out.`,
			'',
			`If that was you, there is nothing more to do. Log in here: ${origin}/login`,
			`If it wasn't you, reset your password straight away: ${origin}/forgot-password`
		].join('\n')
	});
}
