<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		AccountChip,
		Alert,
		AuthSplit,
		Button,
		CheckboxField,
		Countdown,
		Heading,
		Stack,
		StatusIcon,
		Text,
		TextField,
		TextLink
	} from '$lib/ui';

	let { form } = $props();

	const step = $derived(form?.step ?? 'email');

	// svelte-ignore state_referenced_locally
	let email = $state(form?.email ?? '');
	let password = $state('');
	let submitting = $state(false);

	const submit = () => {
		submitting = true;
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			submitting = false;
			password = '';
		};
	};
</script>

<svelte:head>
	<title>Log in · SaaS</title>
</svelte:head>

<AuthSplit
	appName="SaaS"
	headline="Welcome back. Your next event is waiting."
	text="Log in to pick up where you left off."
>
	{#if step === 'paused'}
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Sign-in paused</Heading>
				<Text variant="lead">Too many attempts from this network.</Text>
			</Stack>
			<Alert variant="danger" title="Too many attempts">
				For your security we’ve paused this action. You can try again in
				<Countdown seconds={form?.retryAfterSeconds ?? 0} />. Nothing was changed.
			</Alert>
			<Button href="/login" variant="outline" fullWidth>Back to log in</Button>
		</Stack>
	{:else if step === 'unverified'}
		<StatusIcon icon="mail" variant="pending" />
		<form method="POST" action="?/resend" use:enhance={submit}>
			<input type="hidden" name="email" value={form?.email} />
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Verify your email to continue</Heading>
					<Text variant="lead">
						Your password was correct, but this email address hasn’t been verified yet.
					</Text>
				</Stack>
				<Button type="submit" size="large" fullWidth loading={submitting}>
					Resend verification email
				</Button>
				<Text variant="footnote">
					<TextLink href="/login">Use a different account</TextLink>
				</Text>
			</Stack>
		</form>
	{:else if step === 'password'}
		<form method="POST" action="?/password" novalidate use:enhance={submit}>
			<input type="hidden" name="email" value={form?.email} />
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Enter your password</Heading>
					<Text variant="lead">Signing in to your account.</Text>
				</Stack>

				{#if form?.invalid}
					<Alert variant="danger" title="That email and password didn’t work">
						Check both and try again. After several failed attempts, sign-in for an email is paused
						for a few minutes to protect the account.
					</Alert>
				{/if}

				<Stack gap="fields">
					<AccountChip label={form?.email ?? ''} changeHref="/login" />
					<TextField
						label="Password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
					/>
					<CheckboxField name="rememberMe">Remember me</CheckboxField>
				</Stack>

				<Button type="submit" size="large" fullWidth loading={submitting}>
					{submitting ? 'Signing in…' : 'Log in'}
				</Button>
			</Stack>
		</form>
	{:else}
		<form method="POST" action="?/email" novalidate use:enhance={submit}>
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Welcome back</Heading>
					<Text variant="lead">Log in to manage your events and tickets.</Text>
				</Stack>

				<TextField
					label="Email"
					name="email"
					type="email"
					placeholder="you@example.com"
					autocomplete="username"
					required
					bind:value={email}
					error={form?.emailError
						? 'Enter a valid email address, like name@example.com.'
						: undefined}
				/>

				<Button type="submit" size="large" fullWidth loading={submitting}>
					Continue with email
				</Button>

				<Text variant="footnote">
					New here? <TextLink href="/signup">Create an account</TextLink>
				</Text>
			</Stack>
		</form>
	{/if}
</AuthSplit>
