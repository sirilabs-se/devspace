import { expect, test } from '@playwright/test';
import { browserTestVerificationToken } from '../setup/verification-token';

test('a person can sign up, verify, log out and log back in', async ({ page }) => {
	const email = `e2e-login-${Date.now().toString(36)}@example.com`;

	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

	// Before verifying, the right password leads to "verify your email".
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('heading', { name: 'Verify your email to continue' })).toBeVisible();

	await page.goto(`/verify-email?token=${browserTestVerificationToken(email)}`);
	await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
	await page.getByRole('link', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome, Maya Okafor' })).toBeVisible();

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

	await page.getByRole('link', { name: 'Log in' }).click();
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue with email' }).click();
	await expect(page.getByText(email)).toBeVisible();

	await page.getByLabel('Password', { exact: true }).fill('Wrong-Horse-42');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByText('That email and password didn’t work')).toBeVisible();

	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByLabel('Remember me').check();
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome, Maya Okafor' })).toBeVisible();
});

test('an unknown email gets the same password step and the same error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('nobody-here@example.com');
	await page.getByRole('button', { name: 'Continue with email' }).click();

	await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeVisible();
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByText('That email and password didn’t work')).toBeVisible();
});

test('a signed-out visitor to a page that needs a login is sent to log in', async ({ page }) => {
	await page.goto('/logout');

	await expect(page).toHaveURL('/login?next=%2Flogout');
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('Google and Facebook are offered on login and sign-up, and a failed return explains itself', async ({
	page
}) => {
	for (const path of ['/login', '/signup']) {
		await page.goto(path);
		await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Continue with Facebook' })).toBeVisible();
	}

	await page.goto('/login?error=account_not_linked');
	await expect(page.getByText('That email already has an account')).toBeVisible();
});

test('the login library’s own addresses are not reachable from outside', async ({ request }) => {
	const signUp = await request.post('/api/auth/sign-up/email', {
		data: { email: 'sneaky@example.com', password: 'x', name: 'Sneaky' }
	});
	const session = await request.get('/api/auth/get-session');

	expect(signUp.status()).toBe(404);
	expect(session.status()).toBe(404);
});
