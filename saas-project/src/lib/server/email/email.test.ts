import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from './index';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('sendEmail', () => {
	it('shows the email in the terminal in local mode', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});

		await sendEmail({ to: 'anna@example.com', subject: 'Hello', text: 'A message' });

		expect(info).toHaveBeenCalledOnce();
		const shown = String(info.mock.calls[0][0]);
		expect(shown).toContain('anna@example.com');
		expect(shown).toContain('Hello');
		expect(shown).toContain('A message');
	});
});
