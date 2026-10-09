<script lang="ts">
	import { enhance } from '$app/forms';
	import { passwordChecklist } from '$lib/shared/password-checklist';
	import {
		Alert,
		AuthSplit,
		BenefitList,
		Button,
		CheckboxField,
		Heading,
		PasswordChecklist,
		Stack,
		StatusIcon,
		Text,
		TextField,
		TextLink
	} from '$lib/ui';

	let { form } = $props();

	const usernameRule =
		'Use 3 to 30 letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.';
	const errorMessages: Record<string, string> = {
		name_required: 'Enter your full name.',
		name_too_long: 'Use at most 100 characters.',
		email_invalid: 'Enter a valid email address, like name@example.com.',
		password_too_weak:
			'Use 8+ characters with upper and lowercase letters, a number and a special character.',
		password_too_long: 'Use at most 128 characters.',
		username_invalid: usernameRule,
		username_reserved: "That username isn't available.",
		username_taken: 'That username is already taken.',
		terms_required: 'Confirm that you are 18 or older and accept the Terms and Privacy Policy.'
	};
	const usernameMessages: Record<string, string> = {
		available: 'Available',
		invalid: usernameRule,
		reserved: errorMessages.username_reserved,
		taken: errorMessages.username_taken
	};
	const passwordRuleLabels = {
		length: '8+ characters',
		case: 'Upper & lowercase',
		number: 'A number',
		special: 'A special character'
	};
	const passwordSummaries = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'];

	const message = (code: string | undefined) => (code ? errorMessages[code] : undefined);

	// svelte-ignore state_referenced_locally
	let name = $state(form?.values?.name ?? '');
	// svelte-ignore state_referenced_locally
	let username = $state(form?.values?.username ?? '');
	// svelte-ignore state_referenced_locally
	let email = $state(form?.values?.email ?? '');
	let password = $state('');
	let submitting = $state(false);

	let usernameStatus = $state<'available' | 'invalid' | 'reserved' | 'taken' | undefined>();
	let checkedUsername = $state('');

	const passwordRules = $derived(
		passwordChecklist(password).map((check) => ({
			label: passwordRuleLabels[check.id],
			met: check.met
		}))
	);
	const passwordSummary = $derived(
		passwordSummaries[
			password === '' ? 0 : Math.max(1, passwordRules.filter((rule) => rule.met).length)
		]
	);

	const errorCount = $derived(Object.keys(form?.errors ?? {}).length);

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
		usernameStatus !== undefined && username.trim() !== '' && checkedUsername === username.trim()
	);
</script>

<svelte:head>
	<title>Sign up · SaaS</title>
</svelte:head>

<AuthSplit
	appName="SaaS"
	headline={form?.sent
		? 'Almost there — confirm it’s really you.'
		: 'Your next favourite night out starts here.'}
	text={form?.sent
		? 'A quick email check keeps events, tickets and organizers safe.'
		: 'Join people who discover, host and attend events every week.'}
>
	{#snippet aside()}
		{#if !form?.sent}
			<BenefitList
				items={[
					{ icon: 'compass', text: 'Discover events near you' },
					{ icon: 'ticket', text: 'Register in one tap, keep every ticket' },
					{ icon: 'users', text: 'Host your own events, securely' }
				]}
			/>
		{/if}
	{/snippet}

	{#if form?.sent}
		<StatusIcon icon="mail" variant="strong" />
		<Stack gap="large">
			<Stack gap="small">
				<Heading>Check your inbox</Heading>
				<Text variant="lead">
					If this email can be used, we’ve sent a verification link to <b>{form.email}</b>.
				</Text>
			</Stack>
			<Alert variant="info" title="The link expires in 24 hours">It can only be used once.</Alert>
			<Text variant="footnote">
				Wrong address? <TextLink href="/signup">Change email</TextLink> · Check spam or promotions.
			</Text>
		</Stack>
	{:else}
		<form
			method="POST"
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					submitting = false;
					if (result.type === 'success') password = '';
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading>Create your account</Heading>
					<Text variant="lead">
						Discover events, host your own, and keep every ticket in one place.
					</Text>
				</Stack>

				{#if errorCount > 0}
					<Alert
						variant="danger"
						title="Fix {errorCount} {errorCount === 1 ? 'thing' : 'things'} to continue"
					>
						Fields with a problem are marked below.
					</Alert>
				{/if}

				<Stack gap="fields">
					<TextField
						label="Full name"
						name="name"
						placeholder="Maya Okafor"
						autocomplete="name"
						required
						bind:value={name}
						error={message(form?.errors?.name)}
					/>

					<TextField
						label="Username"
						name="username"
						placeholder="maya.okafor"
						autocomplete="username"
						optional
						hint="Shown on your public profile. You can change it later."
						bind:value={username}
						status={showUsernameStatus && usernameStatus
							? usernameMessages[usernameStatus]
							: undefined}
						statusVariant={usernameStatus === 'available' ? 'success' : 'danger'}
						error={showUsernameStatus ? undefined : message(form?.errors?.username)}
					/>

					<TextField
						label="Email"
						name="email"
						type="email"
						placeholder="you@example.com"
						autocomplete="email"
						required
						bind:value={email}
						error={message(form?.errors?.email)}
					/>

					<TextField
						label="Password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={password}
						error={message(form?.errors?.password)}
					>
						{#snippet below()}
							<PasswordChecklist summary={passwordSummary} rules={passwordRules} />
						{/snippet}
					</TextField>
				</Stack>

				<CheckboxField name="acceptTerms" required error={message(form?.errors?.acceptTerms)}>
					I am 18 or older and agree to the Terms and Privacy Policy.
				</CheckboxField>

				<Button type="submit" size="large" fullWidth loading={submitting}>
					{submitting ? 'Creating account…' : 'Create account'}
				</Button>
			</Stack>
		</form>
	{/if}
</AuthSplit>
