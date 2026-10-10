<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Button,
		CenteredCard,
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

	type Method = 'app' | 'email' | 'backup';

	// svelte-ignore state_referenced_locally
	let method = $state<Method>(form?.method ?? 'app');
	let code = $state('');
	let submitting = $state(false);
	let paused = $derived(!!form?.rateLimited);

	// "Email me a code" answers with the email method chosen.
	$effect(() => {
		if (form?.method) method = form.method;
	});

	const wording = {
		app: {
			title: 'Enter your code',
			text: 'Open your authenticator app and enter the 6-digit code for SaaS.',
			label: '6-digit code',
			wrong: 'That code didn’t match. Codes refresh every 30 seconds — check your device’s clock.'
		},
		email: {
			title: 'Check your email',
			text: 'We sent a 6-digit code to your email address. It works for 10 minutes.',
			label: '6-digit code',
			wrong: 'That code didn’t match. Check the latest email, or ask for a new code.'
		},
		backup: {
			title: 'Use a backup code',
			text: 'Enter one of the backup codes you saved. Each code works once.',
			label: 'Backup code',
			wrong: 'That backup code didn’t work. Each code works only once.'
		}
	};
	const others: { method: Method; label: string }[] = [
		{ method: 'app', label: 'Use your authenticator app' },
		{ method: 'backup', label: 'Use a backup code' }
	];

	const afterSubmit = () => {
		submitting = true;
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			submitting = false;
			code = '';
		};
	};
</script>

<svelte:head>
	<title>Two-step verification · SaaS</title>
</svelte:head>

<CenteredCard>
	<StatusIcon icon={method === 'email' ? 'mail' : method === 'app' ? 'check' : 'link'} />
	<form method="POST" action="?/verify" novalidate use:enhance={afterSubmit}>
		<input type="hidden" name="method" value={method} />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>{wording[method].title}</Heading>
				<Text variant="lead">{wording[method].text}</Text>
			</Stack>

			{#if form?.rateLimited && paused}
				<Alert variant="danger" title="Too many attempts">
					Verification is paused to protect your account. You can try again in
					<Countdown seconds={form.retryAfterSeconds} onfinish={() => (paused = false)} />.
				</Alert>
			{:else if form?.emailSent}
				<Alert variant="success" title="Code sent">Check your inbox for the newest email.</Alert>
			{/if}

			<Stack gap="fields">
				<TextField
					label={wording[method].label}
					name="code"
					autocomplete="one-time-code"
					numeric={method !== 'backup'}
					required
					bind:value={code}
					error={form?.codeWrong ? wording[method].wrong : undefined}
				/>
				<CheckboxField name="trustDevice">Trust this device for 30 days</CheckboxField>
			</Stack>

			<Button type="submit" size="large" fullWidth loading={submitting} disabled={paused}>
				Verify
			</Button>
		</Stack>
	</form>

	<Stack gap="large">
		<span></span>
		<Stack gap="small">
			<Text variant="muted">Other ways to verify</Text>
			<form method="POST" action="?/sendEmailCode" use:enhance={afterSubmit}>
				<Button type="submit" variant="ghost" fullWidth disabled={paused}>
					{method === 'email' ? 'Email me a new code' : 'Email me a code'}
				</Button>
			</form>
			{#each others.filter((other) => other.method !== method) as other (other.method)}
				<Button
					variant="ghost"
					fullWidth
					onclick={() => {
						method = other.method;
						code = '';
					}}
				>
					{other.label}
				</Button>
			{/each}
			<Text variant="footnote"><TextLink href="/login">Back to log in</TextLink></Text>
		</Stack>
	</Stack>
</CenteredCard>
