import nodemailer, { type Transporter } from 'nodemailer';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export type Email = {
	to: string;
	subject: string;
	text: string;
};

const DEFAULT_FROM = 'SaaS <no-reply@localhost>';

let transporter: Transporter | undefined;

function smtpTransporter(): Transporter {
	if (!env.SMTP_URL) throw new Error('SMTP_URL is not set');
	transporter ??= nodemailer.createTransport(env.SMTP_URL);
	return transporter;
}

/**
 * Sends an email.
 *
 * EMAIL_TRANSPORT chooses how:
 * - "smtp" hands it to the server at SMTP_URL. Locally that is the Mailpit
 *   inbox started by `npm run db:up`, which shows every email in a web page.
 * - "console" shows it in the terminal instead of sending it.
 *
 * While developing, the default is "smtp" when SMTP_URL is set and "console"
 * otherwise. Outside development it must be set, so a missing email service
 * can't go unnoticed.
 */
export async function sendEmail(email: Email): Promise<void> {
	const transport = env.EMAIL_TRANSPORT ?? (dev ? (env.SMTP_URL ? 'smtp' : 'console') : undefined);

	if (transport === 'smtp') {
		try {
			await smtpTransporter().sendMail({
				from: env.EMAIL_FROM ?? DEFAULT_FROM,
				to: email.to,
				subject: email.subject,
				text: email.text
			});
		} catch (cause) {
			throw new Error(
				'Could not hand the email to the email server. Locally, start it with `npm run db:up`.',
				{ cause }
			);
		}
		return;
	}

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
		'No email service is set up. Set EMAIL_TRANSPORT to "smtp" (with SMTP_URL) or "console".'
	);
}
