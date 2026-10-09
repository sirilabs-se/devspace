import { expect, test } from '@playwright/test';

test('the placeholder page loads inside the app shell', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'SaaS' })).toBeVisible();
	await expect(page.getByRole('banner')).toContainText('SaaS');
});
