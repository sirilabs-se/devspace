<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, CenteredCard, Heading, Stack, StatusIcon, Text } from '$lib/ui';

	let { data, form } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Undo email change · SaaS</title>
</svelte:head>

<CenteredCard>
	{#if form?.undone}
		<StatusIcon icon="check" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Your email address was restored</Heading>
				<Text variant="lead">
					Your old address signs in again, and every device was signed out. Someone else may know
					your password, so choose a new one now.
				</Text>
			</Stack>
			<Button href="/forgot-password" size="large" fullWidth>Choose a new password</Button>
		</Stack>
	{:else if form?.problem === 'unavailable'}
		<StatusIcon icon="alert" variant="pending" />
		<Stack gap="small">
			<Heading>This change can’t be undone here</Heading>
			<Text variant="lead">
				Your old address is now used by another account. Please contact support.
			</Text>
		</Stack>
	{:else if !data.usable || form?.problem === 'invalid'}
		<StatusIcon icon="link" variant="pending" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>This link can’t be used</Heading>
				<Text variant="lead">
					It may have been used already, copied incorrectly, or be more than 7 days old.
				</Text>
			</Stack>
			<Button href="/login" variant="outline" fullWidth>Back to log in</Button>
		</Stack>
	{:else}
		<StatusIcon icon="alert" variant="danger" />
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Undo the change of email?</Heading>
					<Text variant="lead">
						The email address on your account was changed. If that wasn’t you, undo it here.
					</Text>
				</Stack>
				<Alert variant="warning" title="What happens">
					Your old address will sign in again, and every device will be signed out.
				</Alert>
				<Button type="submit" variant="danger" size="large" fullWidth loading={submitting}>
					Undo the change
				</Button>
			</Stack>
		</form>
	{/if}
</CenteredCard>
