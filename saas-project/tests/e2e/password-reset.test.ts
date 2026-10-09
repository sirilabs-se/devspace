import { expect, test } from '@playwright/test';

test('forgot password shows the same confirmation for any address', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('someone@example.com');
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await page.getByRole('link', { name: 'Forgot password?' }).click();

	await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
	await page.getByLabel('Email').fill('no-account-here@example.com');
	await page.getByRole('button', { name: 'Send reset link' }).click();

	await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
	await expect(page.getByText('no-account-here@example.com')).toBeVisible();
	await expect(page.getByText('The link expires in 1 hour')).toBeVisible();
});

test('a reset link that cannot be used says so and offers a new one', async ({ page }) => {
	await page.goto('/reset-password?token=not-a-real-token');

	await expect(page.getByRole('heading', { name: 'This reset link can’t be used' })).toBeVisible();
	await page.getByRole('link', { name: 'Request a new link' }).click();
	await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
});
