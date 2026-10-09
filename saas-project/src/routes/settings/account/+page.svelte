<script lang="ts">
	import { enhance } from '$app/forms';
	import { describePassword, PASSWORD_RULE_MESSAGE } from '$lib/shared/password-checklist';
	import {
		Alert,
		Button,
		Card,
		Countdown,
		Heading,
		PageHeader,
		PasswordChecklist,
		Stack,
		Text,
		TextField
	} from '$lib/ui';

	let { data, form } = $props();

	let currentPassword = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);

	// svelte-ignore state_referenced_locally
	let newEmail = $state(form?.newEmail ?? '');
	let emailPassword = $state('');
	let sendingEmail = $state(false);

	const guide = $derived(describePassword(password));
</script>

<svelte:head>
	<title>Account settings · SaaS</title>
</svelte:head>

<PageHeader title="Account settings" text="Signed in as {data.email}." />

<Stack gap="large">
	<Card>
		<form
			method="POST"
			action="?/changeEmail"
			novalidate
			use:enhance={() => {
				sendingEmail = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					sendingEmail = false;
					emailPassword = '';
					if (result.type === 'success') newEmail = '';
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading level={2}>Email</Heading>
					<Text variant="lead">
						You sign in as <b>{data.email}</b>. A new address takes effect only after you open the
						link we send to it.
					</Text>
				</Stack>

				{#if form?.emailSent}
					<Alert variant="success" title="Check your new inbox">
						If {form.newEmail} can be used, we’ve sent it a link. Your email stays {data.email} until
						you open it. The link works for 24 hours.
					</Alert>
				{:else if form?.emailError === 'rate_limited'}
					<Alert variant="danger" title="Too many attempts">
						For your security we’ve paused this action. You can try again in
						<Countdown seconds={form.retryAfterSeconds ?? 0} />. Nothing was changed.
					</Alert>
				{/if}

				<Stack gap="fields">
					<TextField
						label="New email"
						name="newEmail"
						type="email"
						placeholder="you@example.com"
						autocomplete="email"
						required
						bind:value={newEmail}
						error={form?.emailError === 'invalid_email'
							? 'Enter a valid email address, like name@example.com.'
							: form?.emailError === 'same_email'
								? 'That’s already your email address.'
								: undefined}
					/>
					{#if data.hasPassword}
						<TextField
							label="Your password"
							name="emailPassword"
							type="password"
							autocomplete="current-password"
							required
							hint="To confirm it’s you."
							bind:value={emailPassword}
							error={form?.emailError === 'current_password_wrong'
								? 'That’s not your password.'
								: undefined}
						/>
					{/if}
				</Stack>

				<Text variant="muted">
					We’ll tell your current address about the change. It can undo it for 7 days.
				</Text>

				<div>
					<Button type="submit" loading={sendingEmail}>Change email</Button>
				</div>
			</Stack>
		</form>
	</Card>

	<Card>
		<form
			method="POST"
			action={data.hasPassword ? '?/changePassword' : '?/setPassword'}
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					submitting = false;
					if (result.type === 'success') {
						currentPassword = '';
						password = '';
						confirmPassword = '';
					}
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading level={2}>{data.hasPassword ? 'Change password' : 'Set a password'}</Heading>
					<Text variant="lead">
						{data.hasPassword
							? 'Choose something long and unique. A password manager helps.'
							: 'You sign in with Google or Facebook. Add a password to have a second way in.'}
					</Text>
				</Stack>

				{#if form?.passwordChanged}
					<Alert variant="success" title="Password updated">We emailed you a confirmation.</Alert>
				{:else if form?.passwordError === 'rate_limited'}
					<Alert variant="danger" title="Too many attempts">
						For your security we’ve paused this action. You can try again in
						<Countdown seconds={form.retryAfterSeconds ?? 0} />. Nothing was changed.
					</Alert>
				{:else if form?.passwordError === 'passwords_differ'}
					<Alert variant="danger" title="The two new passwords don’t match">
						Type the same new password in both fields.
					</Alert>
				{/if}

				<Stack gap="fields">
					{#if data.hasPassword}
						<TextField
							label="Current password"
							name="currentPassword"
							type="password"
							autocomplete="current-password"
							required
							bind:value={currentPassword}
							error={form?.passwordError === 'current_password_wrong'
								? 'That’s not your current password.'
								: undefined}
						/>
					{/if}

					<TextField
						label="New password"
						name="password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={password}
						error={form?.passwordError === 'password_too_weak'
							? PASSWORD_RULE_MESSAGE
							: form?.passwordError === 'password_too_long'
								? 'Use at most 128 characters.'
								: undefined}
					>
						{#snippet below()}
							<PasswordChecklist summary={guide.summary} rules={guide.rules} />
						{/snippet}
					</TextField>

					<TextField
						label="Confirm new password"
						name="confirmPassword"
						type="password"
						autocomplete="new-password"
						required
						bind:value={confirmPassword}
						error={form?.passwordError === 'passwords_differ' ? 'This doesn’t match.' : undefined}
					/>
				</Stack>

				{#if data.hasPassword}
					<Text variant="muted">Saving signs out your other devices. This one stays signed in.</Text
					>
				{/if}

				<div>
					<Button type="submit" loading={submitting}>Save password</Button>
				</div>
			</Stack>
		</form>
	</Card>
</Stack>
