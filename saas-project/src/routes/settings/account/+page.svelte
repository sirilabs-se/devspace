<script lang="ts">
	import { enhance } from '$app/forms';
	import { describePassword, PASSWORD_RULE_MESSAGE } from '$lib/shared/password-checklist';
	import {
		Alert,
		Button,
		Card,
		Countdown,
		Heading,
		PageHeader,
		PasswordChecklist,
		Stack,
		Text,
		TextField
	} from '$lib/ui';

	let { data, form } = $props();

	let currentPassword = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);

	const guide = $derived(describePassword(password));
</script>

<svelte:head>
	<title>Account settings · SaaS</title>
</svelte:head>

<PageHeader title="Account settings" text="Signed in as {data.email}." />

<Card>
	<form
		method="POST"
		action="?/changePassword"
		novalidate
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				submitting = false;
				if (result.type === 'success') {
					currentPassword = '';
					password = '';
					confirmPassword = '';
				}
			};
		}}
	>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Change password</Heading>
				<Text variant="lead">Choose something long and unique. A password manager helps.</Text>
			</Stack>

			{#if form?.passwordChanged}
				<Alert variant="success" title="Password updated">
					Your other devices were signed out, and we emailed you a confirmation.
				</Alert>
			{:else if form?.passwordError === 'rate_limited'}
				<Alert variant="danger" title="Too many attempts">
					For your security we’ve paused this action. You can try again in
					<Countdown seconds={form.retryAfterSeconds ?? 0} />. Nothing was changed.
				</Alert>
			{:else if form?.passwordError === 'passwords_differ'}
				<Alert variant="danger" title="The two new passwords don’t match">
					Type the same new password in both fields.
				</Alert>
			{/if}

			<Stack gap="fields">
				<TextField
					label="Current password"
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					required
					bind:value={currentPassword}
					error={form?.passwordError === 'current_password_wrong'
						? 'That’s not your current password.'
						: undefined}
				/>

				<TextField
					label="New password"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					bind:value={password}
					error={form?.passwordError === 'password_too_weak'
						? PASSWORD_RULE_MESSAGE
						: form?.passwordError === 'password_too_long'
							? 'Use at most 128 characters.'
							: undefined}
				>
					{#snippet below()}
						<PasswordChecklist summary={guide.summary} rules={guide.rules} />
					{/snippet}
				</TextField>

				<TextField
					label="Confirm new password"
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					bind:value={confirmPassword}
					error={form?.passwordError === 'passwords_differ' ? 'This doesn’t match.' : undefined}
				/>
			</Stack>

			<Text variant="muted">Saving signs out your other devices. This one stays signed in.</Text>

			<div>
				<Button type="submit" loading={submitting}>Save password</Button>
			</div>
		</Stack>
	</form>
</Card>
