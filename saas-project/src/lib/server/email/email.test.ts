import { afterEach, describe, expect, it, vi } from 'vitest';

const smtp = vi.hoisted(() => ({
	sendMail: vi.fn(),
	createTransport: vi.fn()
}));
smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });

vi.mock('nodemailer', () => ({ default: { createTransport: smtp.createTransport } }));

const settings = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => settings);

import { sendEmail } from './index';

const email = { to: 'anna@example.com', subject: 'Hello', text: 'A message' };

afterEach(() => {
	vi.restoreAllMocks();
	smtp.sendMail.mockReset();
	settings.env = {};
});

describe('sendEmail', () => {
	it('shows the email in the terminal in console mode', async () => {
		settings.env = { EMAIL_TRANSPORT: 'console' };
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});

		await sendEmail(email);

		expect(info).toHaveBeenCalledOnce();
		const shown = String(info.mock.calls[0][0]);
		expect(shown).toContain('anna@example.com');
		expect(shown).toContain('Hello');
		expect(shown).toContain('A message');
		expect(smtp.sendMail).not.toHaveBeenCalled();
	});

	it('hands the email to the SMTP server in smtp mode', async () => {
		settings.env = {
			EMAIL_TRANSPORT: 'smtp',
			SMTP_URL: 'smtp://localhost:1025',
			EMAIL_FROM: 'SaaS <hello@example.com>'
		};

		await sendEmail(email);

		expect(smtp.createTransport).toHaveBeenCalledWith('smtp://localhost:1025');
		expect(smtp.sendMail).toHaveBeenCalledWith({
			from: 'SaaS <hello@example.com>',
			to: 'anna@example.com',
			subject: 'Hello',
			text: 'A message'
		});
	});

	it('uses SMTP while developing when a server address is set and no mode is chosen', async () => {
		settings.env = { SMTP_URL: 'smtp://localhost:1025' };

		await sendEmail(email);

		expect(smtp.sendMail).toHaveBeenCalledOnce();
		expect(smtp.sendMail.mock.calls[0][0].from).toBe('SaaS <no-reply@localhost>');
	});

	it('explains what to do when the email server cannot be reached', async () => {
		settings.env = { EMAIL_TRANSPORT: 'smtp', SMTP_URL: 'smtp://localhost:1025' };
		smtp.sendMail.mockRejectedValue(new Error('connect ECONNREFUSED'));

		await expect(sendEmail(email)).rejects.toThrow(/npm run db:up/);
	});

	it('refuses an unknown mode instead of silently dropping the email', async () => {
		settings.env = { EMAIL_TRANSPORT: 'carrier-pigeon' };

		await expect(sendEmail(email)).rejects.toThrow(/No email service is set up/);
	});
});
