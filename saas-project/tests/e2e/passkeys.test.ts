import { expect, test } from './base';
import { browserTestVerificationToken } from '../setup/verification-token';

test('a person can add a passkey, sign in with it, and remove it', async ({ page }) => {
	// A pretend authenticator built into the test browser, standing in for a fingerprint reader.
	const devtools = await page.context().newCDPSession(page);
	await devtools.send('WebAuthn.enable');
	await devtools.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});

	const email = `e2e-passkey-${Date.now().toString(36)}@example.com`;
	await page.goto('/signup');
	await page.getByLabel('Full name').fill('Maya Okafor');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-42');
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await page.goto(`/verify-email?token=${browserTestVerificationToken(email)}`);
	await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();

	await page.goto('/settings/security');
	await expect(page.getByText('You have no passkeys yet.')).toBeVisible();
	await page.getByLabel('Name for a new passkey').fill('Test laptop');
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await expect(page.getByRole('status').getByText('Passkey added')).toBeVisible();
	await expect(page.locator('b', { hasText: 'Test laptop' })).toBeVisible();

	await page.getByRole('button', { name: 'Log out' }).click();
	await page.getByRole('link', { name: 'Log in' }).click();
	await page.getByRole('button', { name: 'Continue with passkey' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome, Maya Okafor' })).toBeVisible();

	await page.goto('/settings/security');
	// The passkey sign-in and the new passkey are both in the activity list.
	await expect(page.getByText('Passkey added', { exact: true })).toBeVisible();
	await expect(page.getByText('Signed in', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Remove Test laptop' }).click();
	await expect(page.getByText('Passkey removed', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('You have no passkeys yet.')).toBeVisible();
});

test('passkey sign-in with no passkey on the device explains itself', async ({ page }) => {
	const devtools = await page.context().newCDPSession(page);
	await devtools.send('WebAuthn.enable');
	await devtools.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});

	await page.goto('/login');
	await page.getByRole('button', { name: 'Continue with passkey' }).click();

	await expect(page.getByText('Passkey sign-in didn’t finish')).toBeVisible({ timeout: 15000 });
	await expect(page.getByRole('button', { name: 'Continue with email' })).toBeVisible();
});
