import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export type Email = {
	to: string;
	subject: string;
	text: string;
};

/**
 * Sends an email. Locally it is shown in the terminal instead of being sent.
 * No email service is chosen yet, so that is the only way of sending for now.
 */
export async function sendEmail(email: Email): Promise<void> {
	const transport = env.EMAIL_TRANSPORT ?? (dev ? 'console' : undefined);

	if (transport === 'console') {
		console.info(
			[
				'',
				'──────── Email (not sent: local mode) ────────',
				`To:      ${email.to}`,
				`Subject: ${email.subject}`,
				'',
				email.text,
				'──────────────────────────────────────────────',
				''
			].join('\n')
		);
		return;
	}

	throw new Error(
		'No email service is set up. Set EMAIL_TRANSPORT=console to show emails locally.'
	);
}
