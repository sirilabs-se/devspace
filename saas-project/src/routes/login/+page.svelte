<script lang="ts">
	import { enhance } from '$app/forms';
	import { signInWithPasskey } from '$lib/shared/passkey-browser';
	import {
		AccountChip,
		Alert,
		AuthSplit,
		Button,
		CheckboxField,
		Countdown,
		Divider,
		Heading,
		ProviderButton,
		Stack,
		StatusIcon,
		Text,
		TextField,
		TextLink
	} from '$lib/ui';

	let { data, form } = $props();

	const providerNames: Record<string, string> = { google: 'Google', facebook: 'Facebook' };
	const socialErrors: Record<string, { title: string; text: string }> = {
		banned: {
			title: 'This account is suspended',
			text: 'Access has been paused, and you can’t sign in until it is lifted.'
		},
		account_not_linked: {
			title: 'That email already has an account',
			text: 'Log in with your password, then connect Google or Facebook from your settings.'
		}
	};
	const socialError = $derived(
		data.socialError
			? (socialErrors[data.socialError] ?? {
					title: 'Sign-in didn’t finish',
					text: 'It was cancelled or something went wrong. Nothing has changed. Please try again.'
				})
			: undefined
	);

	const step = $derived(form?.step ?? 'email');

	// Carries the page the person was heading for through each step, so login can send them back.
	const nextQuery = $derived(data.next === '/' ? '' : `&next=${encodeURIComponent(data.next)}`);

	let usingPasskey = $state(false);
	let passkeyProblem = $state<string>();
	const passkeyProblems: Record<string, string> = {
		unsupported: 'This browser can’t use passkeys. Log in with your email instead.',
		cancelled: 'Passkey sign-in was cancelled or timed out. Nothing has changed on your account.',
		refused: 'That passkey didn’t work here. Log in with your email instead.'
	};

	async function usePasskey() {
		usingPasskey = true;
		passkeyProblem = undefined;
		const result = await signInWithPasskey();
		if (result.ok) {
			// A full page load, so every part of the app sees the new session.
			window.location.assign(data.next);
			return;
		}
		usingPasskey = false;
		passkeyProblem = passkeyProblems[result.reason] ?? passkeyProblems.refused;
	}

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
			<Stack gap="medium">
				<Button href="/forgot-password" variant="outline" fullWidth>Reset password instead</Button>
				<Button href="/login" variant="ghost" fullWidth>Back to log in</Button>
			</Stack>
		</Stack>
	{:else if step === 'suspended'}
		<StatusIcon icon="alert" variant="danger" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>This account is suspended</Heading>
				<Text variant="lead">
					Access has been paused, and you can’t sign in until it is lifted. We’ve emailed you the
					reason. If you think this is a mistake, reply to that email.
				</Text>
			</Stack>
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
		<form method="POST" action="?/password{nextQuery}" novalidate use:enhance={submit}>
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
					<Text variant="muted"><TextLink href="/forgot-password">Forgot password?</TextLink></Text>
				</Stack>

				<Button type="submit" size="large" fullWidth loading={submitting}>
					{submitting ? 'Signing in…' : 'Log in'}
				</Button>
			</Stack>
		</form>
	{:else}
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Welcome back</Heading>
				<Text variant="lead">Log in to manage your events and tickets.</Text>
			</Stack>

			{#if passkeyProblem}
				<Alert variant="danger" title="Passkey sign-in didn’t finish">{passkeyProblem}</Alert>
			{/if}

			<Stack gap="small">
				<Button size="large" fullWidth loading={usingPasskey} onclick={usePasskey}>
					Continue with passkey
				</Button>
				<Text variant="footnote">
					Fastest and most secure — fingerprint, face or a security key. Nothing to type.
				</Text>
			</Stack>
		</Stack>

		<Divider label="or use your email" />

		<form method="POST" action="?/email{nextQuery}" novalidate use:enhance={submit}>
			<Stack gap="large">
				{#if data.notice === 'deletion-scheduled'}
					<Alert variant="info" title="Your account is scheduled for deletion">
						You’ve been signed out everywhere. Log in within 30 days to keep the account; otherwise
						it is removed for good.
					</Alert>
				{/if}
				{#if socialError}
					<Alert variant="danger" title={socialError.title}>{socialError.text}</Alert>
				{/if}

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

				<Button type="submit" variant="outline" fullWidth loading={submitting}>
					Continue with email
				</Button>
			</Stack>
		</form>

		{#if data.providers.length > 0}
			<Divider label="or" />
			<form method="POST" action="?/social">
				<Stack gap="medium">
					{#each data.providers as provider (provider)}
						<ProviderButton value={provider} label="Continue with {providerNames[provider]}" />
					{/each}
				</Stack>
			</form>
		{/if}

		<Stack gap="large">
			<span></span>
			<Text variant="footnote">
				New here? <TextLink href="/signup">Create an account</TextLink>
			</Text>
		</Stack>
	{/if}
</AuthSplit>
