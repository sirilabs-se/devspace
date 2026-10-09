<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, CenteredCard, CheckboxField, Heading, Stack, Text, TextField } from '$lib/ui';

	let { data, form } = $props();

	const usernameRule =
		'Use 3 to 30 letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.';
	const errorMessages: Record<string, string> = {
		username_invalid: usernameRule,
		username_reserved: 'That username isn’t available.',
		username_taken: 'That username is already taken.',
		terms_required: 'Confirm that you are 18 or older and accept the Terms and Privacy Policy.'
	};
	const message = (code: string | undefined) => (code ? errorMessages[code] : undefined);

	// svelte-ignore state_referenced_locally
	let username = $state(form?.username ?? '');
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Welcome · SaaS</title>
</svelte:head>

<CenteredCard>
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
				<Heading>Welcome, {data.name}</Heading>
				<Text variant="lead">
					You’re signing in as {data.email}. One last step before you start.
				</Text>
			</Stack>

			<TextField
				label="Username"
				name="username"
				placeholder="maya.okafor"
				autocomplete="username"
				optional
				hint="Shown on your public profile. You can add or change it later."
				bind:value={username}
				error={message(form?.errors?.username)}
			/>

			<CheckboxField name="acceptTerms" required error={message(form?.errors?.acceptTerms)}>
				I am 18 or older and agree to the Terms and Privacy Policy.
			</CheckboxField>

			<Button type="submit" size="large" fullWidth loading={submitting}>Continue</Button>
		</Stack>
	</form>

	<form method="POST" action="/logout">
		<Text variant="footnote">
			Not you? <Button type="submit" variant="ghost" size="small">Log out</Button>
		</Text>
	</form>
</CenteredCard>
