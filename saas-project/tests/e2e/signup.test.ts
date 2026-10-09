import { expect, test } from '@playwright/test';

test('a new person can sign up and is told to check their email', async ({ page }) => {
	const unique = Date.now().toString(36);

	await page.goto('/signup');
	await page.getByLabel('Email').fill(`e2e-${unique}@example.com`);
	await page.getByLabel('Username').fill(`e2e-${unique}`);
	await expect(page.getByText('Available', { exact: true })).toBeVisible();
	await page.getByLabel('Password').fill('correct horse battery');
	await expect(page.getByText('Strong', { exact: true })).toBeVisible();
	await page.getByLabel(/terms of service/).check();
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
});

test('sign-up shows clear errors for a short password and unticked boxes', async ({ page }) => {
	await page.goto('/signup');
	await page.getByLabel('Email').fill('someone@example.com');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('short');
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
	await expect(page.getByText("That username isn't available.")).toBeVisible();
	await expect(page.getByText('You need to accept the terms')).toBeVisible();
	await expect(page.getByText('You need to confirm that you are 18 or older.')).toBeVisible();
});
