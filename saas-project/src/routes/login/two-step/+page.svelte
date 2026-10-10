<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Button,
		CenteredCard,
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
	let method = $state<'app' | 'backup'>(form?.method === 'backup' ? 'backup' : 'app');
	let code = $state('');
	let submitting = $state(false);
	let paused = $derived(!!form?.rateLimited);
</script>

<svelte:head>
	<title>Two-step verification · SaaS</title>
</svelte:head>

<CenteredCard>
	<StatusIcon icon={method === 'app' ? 'check' : 'link'} />
	<form
		method="POST"
		novalidate
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
				code = '';
			};
		}}
	>
		<input type="hidden" name="method" value={method} />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>{method === 'app' ? 'Enter your code' : 'Use a backup code'}</Heading>
				<Text variant="lead">
					{method === 'app'
						? 'Open your authenticator app and enter the 6-digit code for SaaS.'
						: 'Enter one of the backup codes you saved. Each code works once.'}
				</Text>
			</Stack>

			{#if form?.rateLimited && paused}
				<Alert variant="danger" title="Too many incorrect codes">
					Verification is paused to protect your account. You can try again in
					<Countdown seconds={form.retryAfterSeconds} onfinish={() => (paused = false)} />.
				</Alert>
			{/if}

			<TextField
				label={method === 'app' ? '6-digit code' : 'Backup code'}
				name="code"
				autocomplete="one-time-code"
				numeric={method === 'app'}
				required
				bind:value={code}
				error={form?.codeWrong
					? method === 'app'
						? 'That code didn’t match. Codes refresh every 30 seconds — check your device’s clock.'
						: 'That backup code didn’t work. Each code works only once.'
					: undefined}
			/>

			<Button type="submit" size="large" fullWidth loading={submitting} disabled={paused}>
				Verify
			</Button>
		</Stack>
	</form>

	<Stack gap="large">
		<span></span>
		<Stack gap="small">
			<Button
				variant="ghost"
				fullWidth
				onclick={() => {
					method = method === 'app' ? 'backup' : 'app';
					code = '';
				}}
			>
				{method === 'app' ? 'Use a backup code instead' : 'Use your authenticator app instead'}
			</Button>
			<Text variant="footnote"><TextLink href="/login">Back to log in</TextLink></Text>
		</Stack>
	</Stack>
</CenteredCard>
