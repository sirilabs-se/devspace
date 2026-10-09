<script lang="ts">
	import { enhance } from '$app/forms';
	import { passwordStrength } from '$lib/shared/password-strength';
	import {
		Button,
		Card,
		CheckboxField,
		FormLayout,
		Heading,
		Notice,
		Stack,
		StrengthMeter,
		Text,
		TextField
	} from '$lib/ui';

	let { form } = $props();

	const errorMessages: Record<string, string> = {
		email_invalid: 'Enter a valid email address.',
		password_too_short: 'Use at least 10 characters.',
		password_too_long: 'Use at most 128 characters.',
		username_invalid: 'Use 3 to 30 letters, numbers, hyphens or underscores.',
		username_reserved: "That username isn't available.",
		username_taken: 'That username is already taken.',
		terms_required: 'You need to accept the terms and privacy policy.',
		age_required: 'You need to confirm that you are 18 or older.'
	};
	const strengthLabels = ['', 'Too short', 'Fair', 'Good', 'Strong'];
	const usernameMessages: Record<string, string> = {
		available: 'Available',
		invalid: errorMessages.username_invalid,
		reserved: errorMessages.username_reserved,
		taken: errorMessages.username_taken
	};

	const message = (code: string | undefined) => (code ? errorMessages[code] : undefined);

	// svelte-ignore state_referenced_locally
	let email = $state(form?.values?.email ?? '');
	// svelte-ignore state_referenced_locally
	let username = $state(form?.values?.username ?? '');
	let password = $state('');
	let submitting = $state(false);

	let usernameStatus = $state<'available' | 'invalid' | 'reserved' | 'taken' | undefined>();
	let checkedUsername = $state('');

	const strength = $derived(passwordStrength(password));

	// Asks the server whether the username is free, shortly after typing stops.
	$effect(() => {
		const candidate = username.trim();
		if (candidate === '') {
			usernameStatus = undefined;
			return;
		}

		const timer = setTimeout(async () => {
			const response = await fetch(
				`/api/username-available?username=${encodeURIComponent(candidate)}`
			);
			if (!response.ok || candidate !== username.trim()) return;
			const result: { available: boolean; reason?: 'invalid' | 'reserved' | 'taken' } =
				await response.json();
			usernameStatus = result.available ? 'available' : result.reason;
			checkedUsername = candidate;
		}, 300);

		return () => clearTimeout(timer);
	});

	const showUsernameStatus = $derived(
		usernameStatus !== undefined && checkedUsername === username.trim()
	);
</script>

<svelte:head>
	<title>Sign up · SaaS</title>
</svelte:head>

<FormLayout>
	<Card>
		{#if form?.sent}
			<Stack>
				<Heading>Check your email</Heading>
				<Notice variant="success">
					We've sent you an email with a link to confirm your address. The link works for 24 hours.
				</Notice>
				<Text variant="muted">Nothing there? Check your spam folder.</Text>
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
						password = '';
					};
				}}
			>
				<Stack gap="large">
					<Heading>Create your account</Heading>

					<TextField
						label="Email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						error={message(form?.errors?.email)}
					/>

					<TextField
						label="Username"
						name="username"
						autocomplete="username"
						required
						hint="Your public handle. 3 to 30 letters, numbers, hyphens or underscores."
						bind:value={username}
						status={showUsernameStatus && usernameStatus
							? usernameMessages[usernameStatus]
							: undefined}
						statusVariant={usernameStatus === 'available' ? 'success' : 'danger'}
						error={showUsernameStatus ? undefined : message(form?.errors?.username)}
					/>

					<TextField
						label="Password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						hint="At least 10 characters. A longer phrase is stronger."
						bind:value={password}
						error={message(form?.errors?.password)}
					>
						{#snippet below()}
							{#if strength > 0}
								<StrengthMeter level={strength} label={strengthLabels[strength]} />
							{/if}
						{/snippet}
					</TextField>

					<CheckboxField name="acceptTerms" required error={message(form?.errors?.acceptTerms)}>
						I accept the terms of service and the privacy policy.
					</CheckboxField>

					<CheckboxField name="confirmAge" required error={message(form?.errors?.confirmAge)}>
						I am 18 or older.
					</CheckboxField>

					<Button type="submit" disabled={submitting}>
						{submitting ? 'Creating account…' : 'Create account'}
					</Button>
				</Stack>
			</form>
		{/if}
	</Card>
</FormLayout>
