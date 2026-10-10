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

export async function sendEmailChangeVerificationEmail(
	to: string,
	verifyUrl: string
): Promise<void> {
	await sendEmail({
		to,
		subject: `Confirm your new email for ${APP_NAME}`,
		text: [
			`Someone asked to use this address for their ${APP_NAME} account.`,
			'',
			'Open this link to confirm. It works for 24 hours. Until then, nothing changes.',
			verifyUrl,
			'',
			"If it wasn't you, you can ignore this email."
		].join('\n')
	});
}

/** Sent to the old address once a change of email has taken effect. */
export async function sendEmailChangedNotice(
	to: string,
	undoUrl: string,
	days: number
): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} email address was changed`,
		text: [
			`The email address for your ${APP_NAME} account was just changed, so this address no longer signs in.`,
			'',
			'If that was you, there is nothing more to do.',
			`If it wasn't you, open this link within ${days} days to undo the change and sign every device out:`,
			undoUrl
		].join('\n')
	});
}

export async function sendEmailChangeUndoneEmail(to: string, origin: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} email address was restored`,
		text: [
			`The change of email on your ${APP_NAME} account was undone. This address signs in again, and every device was signed out.`,
			'',
			`Someone else may know your password. Choose a new one now: ${origin}/forgot-password`
		].join('\n')
	});
}

const longDate = (date: Date) =>
	date.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});

export async function sendDeletionScheduledEmail(
	to: string,
	deleteAt: Date,
	origin: string
): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} account is scheduled for deletion`,
		text: [
			`You asked to delete your ${APP_NAME} account. Every device has been signed out.`,
			'',
			`The account and its data will be permanently removed on ${longDate(deleteAt)}.`,
			`Changed your mind? Log in before then and the deletion is cancelled: ${origin}/login`,
			'',
			`If it wasn't you, log in now and change your password.`
		].join('\n')
	});
}

export async function sendDeletionCancelledEmail(to: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} account will not be deleted`,
		text: [
			`You signed in to ${APP_NAME}, so the deletion of your account was cancelled. Nothing was removed.`,
			'',
			'If you still want to delete it, you can ask again from your account settings.'
		].join('\n')
	});
}

export async function sendAccountDeletedEmail(to: string): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} account has been deleted`,
		text: [
			`Your ${APP_NAME} account and its data have now been permanently removed, as you asked.`,
			'',
			'This is the last email you will receive about it.'
		].join('\n')
	});
}

export async function sendTwoStepCodeEmail(
	to: string,
	code: string,
	minutes: number
): Promise<void> {
	await sendEmail({
		to,
		subject: `Your ${APP_NAME} sign-in code`,
		text: [
			`Your sign-in code is ${code}`,
			'',
			`Enter it to finish logging in. It works for ${minutes} minutes.`,
			'',
			"If you didn't try to log in, someone else knows your password. Change it now."
		].join('\n')
	});
}
