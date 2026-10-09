import { expect, test } from '@playwright/test';

test('a new person can sign up and is told to check their inbox', async ({ page }) => {
	const unique = Date.now().toString(36);
	const email = `e2e-${unique}@example.com`;

	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Username').fill(`maya.${unique}`);
	await expect(page.getByText('Available', { exact: true })).toBeVisible();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await expect(page.getByText('Strong', { exact: true })).toBeVisible();
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page).toHaveURL('/verify-email');
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await expect(page.getByText(email)).toBeVisible();

	await page.getByRole('button', { name: 'Resend email' }).click();
	await expect(page.getByText('Sent again')).toBeVisible();
	await expect(page.getByRole('button', { name: /Resend in 00:/ })).toBeDisabled();

	await page.getByRole('link', { name: 'Change email' }).click();
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('sign-up works without a username', async ({ page }) => {
	const unique = Date.now().toString(36);

	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(`e2e-nouser-${unique}@example.com`);
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
});

test('the password checklist marks each rule as it is met', async ({ page }) => {
	await page.goto('/signup');
	const rule = (label: string) => page.getByRole('listitem').filter({ hasText: label });

	await page.getByLabel('Password', { exact: true }).fill('abcdefgh');

	await expect(rule('8+ characters')).toContainText('met');
	await expect(rule('8+ characters')).not.toContainText('not met');
	await expect(rule('Upper & lowercase')).toContainText('not met');
	await expect(rule('A number')).toContainText('not met');
	await expect(rule('A special character')).toContainText('not met');
});

test('sign-up shows clear errors and a summary', async ({ page }) => {
	await page.goto('/signup');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Email').fill('someone@example.com');
	await page.getByLabel('Password', { exact: true }).fill('short');
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByText('Fix 4 things to continue')).toBeVisible();
	await expect(page.getByText('Enter your full name.')).toBeVisible();
	await expect(page.getByText("That username isn't available.")).toBeVisible();
	await expect(page.getByText(/Use 8\+ characters with upper and lowercase/)).toBeVisible();
	await expect(page.getByText(/Confirm that you are 18 or older/)).toBeVisible();
	// The typed password is kept, so the checklist still shows what is missing.
	await expect(page.getByLabel('Password', { exact: true })).toHaveValue('short');
});
