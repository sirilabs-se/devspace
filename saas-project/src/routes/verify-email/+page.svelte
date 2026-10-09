<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		AuthSplit,
		Button,
		Heading,
		Stack,
		StatusIcon,
		Text,
		TextField,
		TextLink
	} from '$lib/ui';

	let { data, form } = $props();

	const RESEND_COOLDOWN_SECONDS = 60;

	let secondsLeft = $state(0);
	let sending = $state(false);
	let expiredEmail = $state('');

	// The "please wait" screen replaces whichever screen asked for the resend.
	const screen = $derived(form?.throttled ? 'throttled' : data.state);

	// Counts down after a resend, and while the hourly limit is in force.
	$effect(() => {
		if (form?.throttled) secondsLeft = form.retryAfterSeconds;
		else if (form?.resent) secondsLeft = RESEND_COOLDOWN_SECONDS;
	});
	$effect(() => {
		if (secondsLeft <= 0) return;
		const timer = setTimeout(() => (secondsLeft -= 1), 1000);
		return () => clearTimeout(timer);
	});

	const clock = $derived(
		`${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
	);

	const submitting = () => {
		sending = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			sending = false;
		};
	};
</script>

<svelte:head>
	<title>Verify your email · SaaS</title>
</svelte:head>

<AuthSplit
	appName="SaaS"
	headline="Almost there — confirm it’s really you."
	text="A quick email check keeps events, tickets and organizers safe."
>
	{#if screen === 'throttled'}
		<StatusIcon icon="hourglass" variant="pending" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Please wait a moment</Heading>
				<Text variant="lead">
					You’ve requested several emails. You can request another in <b>{clock}</b>.
				</Text>
			</Stack>
			<Alert variant="info" title="Tips while you wait">
				Check your spam and promotions folders.
			</Alert>
			<Button href="/signup" variant="outline" fullWidth>Change email address</Button>
		</Stack>
	{:else if screen === 'verified'}
		<StatusIcon icon="check" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Email verified</Heading>
				<Text variant="lead">
					Thanks, {data.email} is confirmed. You can now register for events and host your own.
				</Text>
			</Stack>
			<Button href="/" size="large" fullWidth>Continue</Button>
		</Stack>
	{:else if screen === 'expired'}
		<StatusIcon icon="clock" variant="pending" />
		<form method="POST" action="?/resend" novalidate use:enhance={submitting}>
			<Stack gap="large">
				<Stack gap="small">
					<Heading>This link has expired</Heading>
					<Text variant="lead">
						Verification links last 24 hours. Request a new one and we’ll send it right away.
					</Text>
				</Stack>
				{#if form?.resent}
					<Alert variant="success" title="Sent">
						If this email can be used, a new link is on its way.
					</Alert>
				{/if}
				<TextField
					label="Email"
					name="email"
					type="email"
					autocomplete="email"
					required
					bind:value={expiredEmail}
					error={form?.emailError
						? 'Enter a valid email address, like name@example.com.'
						: undefined}
				/>
				<Button type="submit" size="large" fullWidth loading={sending} disabled={secondsLeft > 0}>
					{secondsLeft > 0 ? `Send again in ${clock}` : 'Send a new link'}
				</Button>
			</Stack>
		</form>
	{:else if screen === 'invalid'}
		<StatusIcon icon="link" variant="pending" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>This link can’t be used</Heading>
				<Text variant="lead">
					It may have been used already or copied incorrectly. If you’re already verified, just log
					in.
				</Text>
			</Stack>
			<Stack gap="medium">
				<Button href="/login" size="large" fullWidth>Log in</Button>
				<Button href="/verify-email" variant="outline" fullWidth>Request a new link</Button>
			</Stack>
		</Stack>
	{:else}
		<StatusIcon icon="mail" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Check your inbox</Heading>
				<Text variant="lead">
					{#if data.email}
						If this email can be used, we’ve sent a verification link to <b>{data.email}</b>.
					{:else}
						If your email can be used, we’ve sent you a verification link.
					{/if}
				</Text>
			</Stack>
			<Alert variant="info" title="The link expires in 24 hours">It can only be used once.</Alert>
			{#if form?.resent}
				<Alert variant="success" title="Sent again">Check your inbox for the new link.</Alert>
			{/if}
			<Stack gap="medium">
				<Button href="/" variant="outline" fullWidth>I’ve verified — continue</Button>
				{#if data.email}
					<form method="POST" action="?/resend" use:enhance={submitting}>
						<Button
							type="submit"
							variant="ghost"
							fullWidth
							loading={sending}
							disabled={secondsLeft > 0}
						>
							{secondsLeft > 0 ? `Resend in ${clock}` : 'Resend email'}
						</Button>
					</form>
				{/if}
			</Stack>
			<Text variant="footnote">
				Wrong address? <TextLink href="/signup">Change email</TextLink> · Check spam or promotions.
			</Text>
		</Stack>
	{/if}
</AuthSplit>
