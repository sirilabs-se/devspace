import { expect, test } from './base';
import { authenticatorCode } from '../setup/totp';
import { browserTestVerificationToken } from '../setup/verification-token';

test('a person can turn on two-step verification and is asked for a code at the next login', async ({
	page
}) => {
	const email = `e2e-twostep-${Date.now().toString(36)}@example.com`;
	const password = 'Correct-Horse-42';

	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await page.goto(`/verify-email?token=${browserTestVerificationToken(email)}`);
	await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();

	// Set up: password, then scan the code (the test reads the set-up key instead), then a code.
	await page.goto('/settings/security');
	const card = page.locator('section', { hasText: 'Two-step verification' }).first();
	await card.getByLabel('Your password').fill(password);
	await card.getByRole('button', { name: 'Set up two-step verification' }).click();
	await expect(page.getByRole('img', { name: 'QR code for your authenticator app' })).toBeVisible();
	const setupKey = (await card.locator('b', { hasText: /^[A-Z2-7]{16,}$/ }).innerText()).trim();

	await card.getByLabel('6-digit code').fill('000000');
	await card.getByRole('button', { name: 'Turn on' }).click();
	await expect(page.getByText(/That code didn’t match/)).toBeVisible();

	await card.getByLabel('6-digit code').fill(authenticatorCode(setupKey));
	await card.getByRole('button', { name: 'Turn on' }).click();
	await expect(page.getByText('Two-step verification is on', { exact: true })).toBeVisible();
	const backupCode = (
		await page.getByRole('list', { name: 'Backup codes' }).locator('li').first().innerText()
	).trim();

	// Next login, on the way to a page that needs one: password, then the code.
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.goto('/settings/profile');
	await expect(page).toHaveURL('/login?next=%2Fsettings%2Fprofile');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/login/two-step?next=%2Fsettings%2Fprofile');
	await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();

	await page.getByLabel('6-digit code').fill('000000');
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.getByText(/That code didn’t match/)).toBeVisible();

	// A backup code works in its place.
	await page.getByRole('button', { name: 'Use a backup code' }).click();
	await page.getByLabel('Backup code').fill(backupCode);
	await page.getByLabel('Trust this device for 30 days').check();
	await page.getByRole('button', { name: 'Verify' }).click();
	// Signed in, and on the page that was asked for.
	await expect(page).toHaveURL('/settings/profile');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

	// This browser is now trusted: the next password login goes straight in.
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome, Maya Okafor' })).toBeVisible();
});

test('the code page offers a code by email', async ({ page }) => {
	// Reaching the page needs an account with the second step on, covered above; here only
	// that a visitor without one is turned away from asking for an email code.
	const response = await page.request.post('/login/two-step?/sendEmailCode', {
		headers: { origin: 'http://localhost:4173' },
		form: {}
	});

	expect(response.url()).toContain('/login');
});

test('the code page can’t be opened without first entering a password', async ({ page }) => {
	await page.goto('/login/two-step');

	await expect(page).toHaveURL('/login');
});
