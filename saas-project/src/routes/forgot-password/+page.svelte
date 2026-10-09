<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		AuthSplit,
		Button,
		Countdown,
		Heading,
		Stack,
		StatusIcon,
		Text,
		TextField,
		TextLink
	} from '$lib/ui';

	let { form } = $props();

	// svelte-ignore state_referenced_locally
	let email = $state(form?.email ?? '');
	let submitting = $state(false);
	let paused = $derived(!!form?.rateLimited);
</script>

<svelte:head>
	<title>Forgot password · SaaS</title>
</svelte:head>

<AuthSplit
	appName="SaaS"
	headline="Locked out? Everyone has been there."
	text="We’ll help you back in — securely."
>
	{#if form?.sent}
		<StatusIcon icon="mail" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Check your email</Heading>
				<Text variant="lead">
					If an account exists for <b>{form.email}</b>, a reset link is on its way.
				</Text>
			</Stack>
			<Alert variant="info" title="Temporary and single-use">
				The link expires in 1 hour and stops working once used.
			</Alert>
			<Text variant="footnote">
				Nothing yet? Check spam or promotions. · <TextLink href="/login">Back to log in</TextLink>
			</Text>
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
					<Heading>Forgot your password?</Heading>
					<Text variant="lead">
						Enter your email and we’ll send a reset link if an account exists.
					</Text>
				</Stack>

				{#if form?.rateLimited && paused}
					<Alert variant="danger" title="Too many attempts">
						For your security we’ve paused this action. You can try again in
						<Countdown seconds={form.retryAfterSeconds} onfinish={() => (paused = false)} />.
						Nothing was changed.
					</Alert>
				{/if}

				<TextField
					label="Email"
					name="email"
					type="email"
					placeholder="you@example.com"
					autocomplete="email"
					required
					bind:value={email}
					error={form?.emailError
						? 'Enter a valid email address, like name@example.com.'
						: undefined}
				/>

				<Button type="submit" size="large" fullWidth loading={submitting} disabled={paused}>
					Send reset link
				</Button>

				<Text variant="footnote"><TextLink href="/login">Back to log in</TextLink></Text>
			</Stack>
		</form>
	{/if}
</AuthSplit>
