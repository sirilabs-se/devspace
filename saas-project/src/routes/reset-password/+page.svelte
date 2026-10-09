<script lang="ts">
	import { enhance } from '$app/forms';
	import { describePassword, PASSWORD_RULE_MESSAGE } from '$lib/shared/password-checklist';
	import {
		Alert,
		AuthSplit,
		Button,
		Heading,
		PasswordChecklist,
		Stack,
		StatusIcon,
		Text,
		TextField
	} from '$lib/ui';

	let { data, form } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);

	// A link can also turn out to be used or expired at the moment of submitting.
	const link = $derived(form?.link ?? data.link);
	const guide = $derived(describePassword(password));

	const deadLinks = {
		expired: {
			icon: 'clock',
			title: 'This reset link has expired',
			text: 'Reset links last 1 hour. Request a new one to continue.'
		},
		invalid: {
			icon: 'link',
			title: 'This reset link can’t be used',
			text: 'It may have been used already or copied incorrectly. Reset links work once. Request a new one to continue.'
		}
	} as const;
</script>

<svelte:head>
	<title>Reset password · SaaS</title>
</svelte:head>

<AuthSplit
	appName="SaaS"
	headline="Locked out? Everyone has been there."
	text="We’ll help you back in — securely."
>
	{#if form?.done}
		<StatusIcon icon="check" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Password updated</Heading>
				<Text variant="lead">
					You’re all set. For your security we signed you out of every device, and we emailed a
					confirmation.
				</Text>
			</Stack>
			<Button href="/login" size="large" fullWidth>Log in</Button>
		</Stack>
	{:else if link !== 'valid'}
		<StatusIcon icon={deadLinks[link].icon} variant="pending" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>{deadLinks[link].title}</Heading>
				<Text variant="lead">{deadLinks[link].text}</Text>
			</Stack>
			<Stack gap="medium">
				<Button href="/forgot-password" size="large" fullWidth>Request a new link</Button>
				<Button href="/login" variant="outline" fullWidth>Back to log in</Button>
			</Stack>
		</Stack>
	{:else}
		<form
			method="POST"
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Choose a new password</Heading>
					<Text variant="lead">This link works once and expires an hour after it was sent.</Text>
				</Stack>

				{#if form?.error === 'passwords_differ'}
					<Alert variant="danger" title="The two passwords don’t match">
						Type the same password in both fields.
					</Alert>
				{/if}

				<Stack gap="fields">
					<TextField
						label="New password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={password}
						error={form?.error === 'password_too_weak'
							? PASSWORD_RULE_MESSAGE
							: form?.error === 'password_too_long'
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
						error={form?.error === 'passwords_differ' ? 'This doesn’t match.' : undefined}
					/>
				</Stack>

				<Button type="submit" size="large" fullWidth loading={submitting}>Update password</Button>

				<Text variant="footnote">Signs you out everywhere else.</Text>
			</Stack>
		</form>
	{/if}
</AuthSplit>
