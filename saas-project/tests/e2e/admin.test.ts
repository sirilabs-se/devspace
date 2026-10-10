import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from './base';
import { testDatabaseUrl } from '../setup/test-env.js';
import { browserTestVerificationToken } from '../setup/verification-token';

const password = 'Correct-Horse-42';

async function signUpAndVerify(page: Page, email: string, name: string) {
	await page.goto('/signup');
	await page.getByLabel('Full name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel(/18 or older/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await page.goto(`/verify-email?token=${browserTestVerificationToken(email)}`);
	await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
}

test('an admin can find a user by email and open their details; others are refused', async ({
	page,
	browser
}) => {
	const unique = Date.now().toString(36);
	const memberEmail = `e2e-member-${unique}@example.com`;
	const adminEmail = `e2e-admin-${unique}@example.com`;

	// An ordinary member, in their own browser.
	const memberContext = await browser.newContext();
	const member = await memberContext.newPage();
	await signUpAndVerify(member, memberEmail, 'Mia Member');
	const refused = await member.goto('/admin/users');
	expect(refused?.status()).toBe(403);
	await expect(member.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
	await memberContext.close();

	// The admin, made with the command-line script.
	await signUpAndVerify(page, adminEmail, 'Ada Admin');
	execFileSync('node', ['scripts/grant-admin.js', adminEmail], {
		env: { ...process.env, DATABASE_URL: testDatabaseUrl(process.env) }
	});

	await page.goto('/');
	await page.getByRole('link', { name: 'Admin', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();

	await page.getByLabel('Search').fill(memberEmail);
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page.getByText(/1\s+person matching/)).toBeVisible();

	await page.getByRole('link', { name: 'Open Mia Member' }).click();
	await expect(page.getByRole('heading', { name: 'Mia Member', level: 1 })).toBeVisible();
	await expect(page.getByText(memberEmail)).toBeVisible();
	await expect(page.getByText('email verified', { exact: true })).toBeVisible();
});

test('an admin can suspend a user, who is then signed out and can’t log in until reinstated', async ({
	page,
	browser
}) => {
	const unique = Date.now().toString(36);
	const memberEmail = `e2e-suspend-${unique}@example.com`;
	const adminEmail = `e2e-suspender-${unique}@example.com`;

	const memberContext = await browser.newContext();
	const member = await memberContext.newPage();
	await signUpAndVerify(member, memberEmail, 'Sam Member');

	await signUpAndVerify(page, adminEmail, 'Ada Admin');
	execFileSync('node', ['scripts/grant-admin.js', adminEmail], {
		env: { ...process.env, DATABASE_URL: testDatabaseUrl(process.env) }
	});
	await page.goto(`/admin/users?q=${encodeURIComponent(memberEmail)}`);
	await page.getByRole('link', { name: 'Open Sam Member' }).click();

	await page.getByRole('button', { name: 'Suspend this account' }).click();
	await expect(page.getByText(/Give a reason/)).toBeVisible();
	await page.getByLabel('Reason').fill('Spamming event pages');
	await page.getByRole('button', { name: 'Suspend this account' }).click();
	await expect(page.getByText('Account suspended', { exact: true })).toBeVisible();
	await expect(page.getByText('This account is suspended')).toBeVisible();

	// The member has been signed out, and the right password no longer gets them in.
	await member.goto('/settings/profile');
	await expect(member).toHaveURL(/\/login/);
	await member.getByLabel('Email').fill(memberEmail);
	await member.getByRole('button', { name: 'Continue with email' }).click();
	await member.getByLabel('Password', { exact: true }).fill(password);
	await member.getByRole('button', { name: 'Log in' }).click();
	await expect(member.getByRole('heading', { name: 'This account is suspended' })).toBeVisible();

	await page.getByRole('button', { name: 'Reinstate this account' }).click();
	await expect(page.getByText('Account reinstated', { exact: true })).toBeVisible();

	await member.goto('/login');
	await member.getByLabel('Email').fill(memberEmail);
	await member.getByRole('button', { name: 'Continue with email' }).click();
	await member.getByLabel('Password', { exact: true }).fill(password);
	await member.getByRole('button', { name: 'Log in' }).click();
	await expect(member.getByRole('heading', { name: 'Welcome, Sam Member' })).toBeVisible();
	await memberContext.close();
});
