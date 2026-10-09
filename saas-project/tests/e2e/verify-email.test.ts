import { expect, test } from '@playwright/test';

test('a link that cannot be used says so and offers a new one', async ({ page }) => {
	await page.goto('/verify-email?token=not-a-real-token');

	await expect(page.getByRole('heading', { name: 'This link can’t be used' })).toBeVisible();
	await page.getByRole('link', { name: 'Request a new link' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
});

test('the fourth resend within an hour shows the "please wait" screen', async ({ page }) => {
	const unique = Date.now().toString(36);

	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(`e2e-wait-${unique}@example.com`);
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

	// Three resends are allowed. Reloading skips the one-minute pause between them.
	for (let attempt = 0; attempt < 3; attempt++) {
		await page.getByRole('button', { name: 'Resend email' }).click();
		await expect(page.getByText('Sent again')).toBeVisible();
		await page.reload();
	}
	await page.getByRole('button', { name: 'Resend email' }).click();

	await expect(page.getByRole('heading', { name: 'Please wait a moment' })).toBeVisible();
	await expect(page.getByText(/request another in \d\d:\d\d/)).toBeVisible();
});
