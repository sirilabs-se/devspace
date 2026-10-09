import { expect, test, type Page } from '@playwright/test';
import { browserTestVerificationToken } from '../setup/verification-token';

const password = 'Correct-Horse-42';

async function signUpAndVerify(page: Page, email: string) {
	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await page.goto(`/verify-email?token=${browserTestVerificationToken(email)}`);
	await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
}

test('settings need a login, and login returns to the page that was asked for', async ({
	page
}) => {
	await page.goto('/settings/security');

	await expect(page).toHaveURL('/login?next=%2Fsettings%2Fsecurity');
});

test('a person can change their password and then sign out everywhere', async ({ page }) => {
	const email = `e2e-settings-${Date.now().toString(36)}@example.com`;
	await signUpAndVerify(page, email);

	await page.getByRole('link', { name: 'Continue' }).click();
	await page.getByRole('link', { name: 'Maya Okafor' }).click();
	await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();

	await page.getByLabel('Current password').fill('Wrong-Horse-42');
	await page.getByLabel('New password', { exact: true }).fill('Brand-New-Horse-7');
	await page.getByLabel('Confirm new password').fill('Brand-New-Horse-7');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByText('That’s not your current password.')).toBeVisible();

	await page.getByLabel('Current password').fill(password);
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByText('Password updated')).toBeVisible();

	await page.getByRole('link', { name: 'Security' }).click();
	await page.getByRole('button', { name: 'Sign out everywhere' }).click();
	await expect(page).toHaveURL('/login');

	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await page.getByLabel('Password', { exact: true }).fill('Brand-New-Horse-7');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome, Maya Okafor' })).toBeVisible();
});

test('a person can edit their profile and the changes are still there after a reload', async ({
	page
}) => {
	const email = `e2e-profile-${Date.now().toString(36)}@example.com`;
	await signUpAndVerify(page, email);

	await page.goto('/settings');
	await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();

	await page.getByLabel('Full name').fill('Maya Okafor-Lindqvist');
	await page.getByLabel('Language').selectOption('sv');
	await page.getByLabel('Time zone').selectOption('Europe/Stockholm');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByText('Profile saved')).toBeVisible();

	await page.reload();
	await expect(page.getByLabel('Full name')).toHaveValue('Maya Okafor-Lindqvist');
	await expect(page.getByLabel('Language')).toHaveValue('sv');
	await expect(page.getByLabel('Time zone')).toHaveValue('Europe/Stockholm');
	await expect(page.getByRole('link', { name: 'Maya Okafor-Lindqvist' })).toBeVisible();
});
