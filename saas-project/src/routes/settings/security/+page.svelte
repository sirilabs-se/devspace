<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { addPasskey, passkeysSupported } from '$lib/shared/passkey-browser';
	import {
		Alert,
		Button,
		Card,
		CodeList,
		Heading,
		ListRow,
		PageHeader,
		QrCode,
		Stack,
		Text,
		TextField
	} from '$lib/ui';
	import type { IconName } from '$lib/ui';

	let { data, form } = $props();

	// The set-up details and backup codes arrive once, from a form action. They are kept
	// here so they stay on screen while the person scans the code and saves the codes.
	let setup = $state<{ totpUri: string; setupKey: string; backupCodes: string[] }>();
	let savedCodes = $state<string[]>();
	let twoStepPassword = $state('');
	let twoStepCode = $state('');
	$effect(() => {
		if (form?.twoStepSetup) setup = form.twoStepSetup;
		if (form?.twoStepTurnedOn && setup) {
			savedCodes = setup.backupCodes;
			setup = undefined;
		}
		if (form?.newBackupCodes) savedCodes = form.newBackupCodes;
		if (form?.twoStepTurnedOff) savedCodes = undefined;
	});
	const twoStepErrors: Record<string, string> = {
		current_password_wrong: 'That’s not your password.',
		code_wrong:
			'That code didn’t match. Codes refresh every 30 seconds — check your device’s clock.',
		already_on: 'Two-step verification is already on.',
		not_on: 'Two-step verification is not on.'
	};
	const clearTwoStepFields = () => {
		return async ({ update }: { update: (options?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			twoStepPassword = '';
			twoStepCode = '';
		};
	};

	let passkeyName = $state('');
	let addingPasskey = $state(false);
	let passkeyMessage = $state<{ variant: 'success' | 'danger'; title: string; text?: string }>();

	const passkeyProblems: Record<string, { title: string; text: string }> = {
		unsupported: {
			title: 'This browser can’t create passkeys',
			text: 'Try a recent version of Chrome, Edge, Safari or Firefox.'
		},
		cancelled: {
			title: 'No passkey was added',
			text: 'It was cancelled or timed out. Nothing has changed on your account.'
		},
		relogin: {
			title: 'Log in again first',
			text: 'For your security, a passkey can only be added shortly after logging in. Log out, log back in, and try again.'
		},
		refused: { title: 'That didn’t work', text: 'The passkey couldn’t be saved. Please try again.' }
	};
	const passkeyErrors: Record<string, string> = {
		last_method:
			'This passkey is your only way to sign in, so it can’t be removed. Set a password first.',
		not_found: 'That passkey no longer exists.',
		name_invalid: 'Give the passkey a name of up to 60 characters.'
	};

	async function createPasskey() {
		addingPasskey = true;
		passkeyMessage = undefined;
		const result = await addPasskey(passkeyName);
		addingPasskey = false;

		if (result.ok) {
			passkeyName = '';
			passkeyMessage = { variant: 'success', title: 'Passkey added' };
			await invalidateAll();
		} else {
			passkeyMessage = { variant: 'danger', ...passkeyProblems[result.reason] };
		}
	}

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			timeZone: data.timeZone
		});

	// How each recorded action is described to the person it concerns.
	const labels: Record<string, { title: string; icon: IconName }> = {
		signup: { title: 'Account created', icon: 'user' },
		signup_existing_email: {
			title: 'Someone tried to sign up with your email',
			icon: 'alert'
		},
		welcome_completed: { title: 'Terms accepted', icon: 'check' },
		email_verified: { title: 'Email verified', icon: 'mail' },
		verification_email_resent: { title: 'Verification email sent again', icon: 'mail' },
		login: { title: 'Signed in', icon: 'check' },
		login_failed: { title: 'Failed sign-in attempt', icon: 'alert' },
		login_locked_out: { title: 'Sign-in attempt while sign-in was paused', icon: 'alert' },
		login_unverified: { title: 'Sign-in attempt before the email was verified', icon: 'mail' },
		logout: { title: 'Signed out', icon: 'x' },
		signed_out_everywhere: { title: 'Signed out of every device', icon: 'x' },
		password_changed: { title: 'Password changed', icon: 'check' },
		password_change_failed: { title: 'Failed attempt to change the password', icon: 'alert' },
		password_set: { title: 'Password set', icon: 'check' },
		password_reset_requested: { title: 'Password reset link requested', icon: 'mail' },
		password_reset: { title: 'Password reset', icon: 'check' },
		email_change_requested: { title: 'Change of email requested', icon: 'mail' },
		email_change_refused: { title: 'Failed attempt to change the email', icon: 'alert' },
		email_changed: { title: 'Email address changed', icon: 'mail' },
		email_change_undone: { title: 'Change of email undone', icon: 'mail' },
		provider_linked: { title: 'Sign-in provider connected', icon: 'link' },
		provider_unlinked: { title: 'Sign-in provider disconnected', icon: 'link' },
		two_step_turned_on: { title: 'Two-step verification turned on', icon: 'check' },
		two_step_turned_off: { title: 'Two-step verification turned off', icon: 'alert' },
		two_step_change_refused: {
			title: 'Failed attempt to change two-step verification',
			icon: 'alert'
		},
		backup_codes_regenerated: { title: 'New backup codes made', icon: 'check' },
		login_new_device: { title: 'Signed in from a new browser', icon: 'alert' },
		data_exported: { title: 'Personal data downloaded', icon: 'check' },
		admin_viewed_user: { title: 'An admin looked at your account', icon: 'info' },
		impersonation_started: { title: 'An admin viewed the app as you', icon: 'alert' },
		impersonation_stopped: { title: 'An admin stopped viewing the app as you', icon: 'info' },
		user_suspended: { title: 'Account suspended', icon: 'alert' },
		user_reinstated: { title: 'Account reinstated', icon: 'check' },
		login_while_suspended: { title: 'Sign-in attempt while suspended', icon: 'alert' },
		two_step_failed: { title: 'Wrong second-step code', icon: 'alert' },
		session_ended: { title: 'Session ended from settings', icon: 'x' },
		passkey_added: { title: 'Passkey added', icon: 'fingerprint' },
		passkey_removed: { title: 'Passkey removed', icon: 'fingerprint' },
		account_deletion_requested: { title: 'Account deletion requested', icon: 'alert' },
		account_deletion_refused: { title: 'Failed attempt to delete the account', icon: 'alert' },
		account_deletion_cancelled: { title: 'Account deletion cancelled', icon: 'check' }
	};
	const describe = (action: string) =>
		labels[action] ?? { title: 'Security event', icon: 'info' as IconName };

	const formatTime = (iso: string) =>
		new Date(iso).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: data.timeZone
		});
</script>

<svelte:head>
	<title>Security · SaaS</title>
</svelte:head>

<PageHeader
	title="Security"
	text="Control where your account is signed in, and see what happened to it."
/>

<Stack gap="large">
	<Card>
		<form method="POST" action="?/signOutEverywhere">
			<Stack gap="large">
				<Stack gap="small">
					<Heading level={2}>Sign out everywhere</Heading>
					<Text variant="lead">
						Ends every session on every device, including this one. You’ll need to log in again.
					</Text>
				</Stack>
				<div>
					<Button type="submit" variant="danger">Sign out everywhere</Button>
				</div>
			</Stack>
		</form>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Passkeys</Heading>
				<Text variant="lead">
					Sign in with your fingerprint, face, screen lock or a security key. Nothing to type, and
					nothing to steal.
				</Text>
			</Stack>

			{#if passkeyMessage}
				<Alert variant={passkeyMessage.variant} title={passkeyMessage.title}>
					{passkeyMessage.text}
				</Alert>
			{:else if form?.passkeyRemoved}
				<Alert variant="success" title="Passkey removed" />
			{:else if form?.passkeyRenamed}
				<Alert variant="success" title="Passkey renamed" />
			{:else if form?.passkeyError}
				<Alert variant="danger" title="That didn’t work">{passkeyErrors[form.passkeyError]}</Alert>
			{/if}

			{#if data.passkeys.length === 0}
				<Text variant="muted">You have no passkeys yet.</Text>
			{:else}
				<div>
					{#each data.passkeys as passkey (passkey.id)}
						<ListRow
							icon="fingerprint"
							title={passkey.name ?? 'Passkey'}
							text="Added {formatDate(passkey.createdAt)}{passkey.syncedAcrossDevices
								? ' · synced across your devices'
								: ' · on one device'}"
						>
							{#snippet action()}
								<form method="POST" action="?/removePasskey" use:enhance>
									<input type="hidden" name="passkeyId" value={passkey.id} />
									<Button type="submit" variant="ghost" size="small">
										Remove<span class="sr-only"> {passkey.name ?? 'passkey'}</span>
									</Button>
								</form>
							{/snippet}
						</ListRow>
					{/each}
				</div>
			{/if}

			<Stack gap="medium">
				<TextField
					label="Name for a new passkey"
					name="passkeyName"
					placeholder="e.g. My laptop"
					optional
					bind:value={passkeyName}
				/>
				<div>
					<Button variant="outline" loading={addingPasskey} onclick={createPasskey}>
						Add a passkey
					</Button>
				</div>
				{#if !passkeysSupported()}
					<Text variant="muted">This browser may not support passkeys.</Text>
				{/if}
			</Stack>
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Two-step verification</Heading>
				<Text variant="lead">
					After your password, also ask for a 6-digit code from an authenticator app on your phone.
					It is {data.twoStepOn ? 'on' : 'off'}.
				</Text>
			</Stack>

			{#if form?.twoStepError}
				<Alert variant="danger" title="That didn’t work">{twoStepErrors[form.twoStepError]}</Alert>
			{:else if form?.twoStepTurnedOn}
				<Alert variant="success" title="Two-step verification is on">
					You’ll be asked for a code the next time you log in with your password.
				</Alert>
			{:else if form?.twoStepTurnedOff}
				<Alert variant="success" title="Two-step verification is off" />
			{/if}

			{#if savedCodes}
				<Stack gap="medium">
					<Alert variant="warning" title="Save these backup codes now">
						Each one works once if you can’t use your authenticator app. They won’t be shown again.
					</Alert>
					<CodeList codes={savedCodes} label="Backup codes" />
				</Stack>
			{/if}

			{#if setup}
				<Stack gap="medium">
					<Text>
						1. Scan this code with your authenticator app, or type the set-up key in by hand.
					</Text>
					<QrCode value={setup.totpUri} label="QR code for your authenticator app" />
					<Text variant="muted">Set-up key: <b>{setup.setupKey}</b></Text>
					<Text>2. Enter the 6-digit code the app shows.</Text>
				</Stack>
				<form method="POST" action="?/confirmTwoStep" novalidate use:enhance={clearTwoStepFields}>
					<Stack gap="medium">
						<TextField
							label="6-digit code"
							name="code"
							autocomplete="one-time-code"
							numeric
							required
							bind:value={twoStepCode}
						/>
						<div><Button type="submit">Turn on</Button></div>
					</Stack>
				</form>
			{:else if !data.hasPassword}
				<Text variant="muted">
					Two-step verification follows a password. Set a password in your account settings first.
				</Text>
			{:else}
				<form
					method="POST"
					action={data.twoStepOn ? '?/newBackupCodes' : '?/startTwoStep'}
					novalidate
					use:enhance={clearTwoStepFields}
				>
					<Stack gap="medium">
						<TextField
							label="Your password"
							name="password"
							type="password"
							autocomplete="current-password"
							required
							hint="To confirm it’s you."
							bind:value={twoStepPassword}
						/>
						<Stack gap="small">
							{#if data.twoStepOn}
								<div><Button type="submit" variant="outline">Get new backup codes</Button></div>
								<div>
									<Button type="submit" variant="danger" formaction="?/turnOffTwoStep">
										Turn off two-step verification
									</Button>
								</div>
							{:else}
								<div><Button type="submit">Set up two-step verification</Button></div>
							{/if}
						</Stack>
					</Stack>
				</form>
			{/if}
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Where you’re signed in</Heading>
				<Text variant="lead">End any session you don’t recognise. That browser is signed out.</Text>
			</Stack>

			{#if form?.sessionEnded}
				<Alert variant="success" title="Session ended" />
			{:else if form?.sessionError}
				<Alert variant="danger" title="That didn’t work">
					{form.sessionError === 'is_current'
						? 'This is the session you’re using. Log out to end it.'
						: 'That session no longer exists.'}
				</Alert>
			{/if}

			<div>
				{#each data.sessions as session (session.id)}
					<ListRow
						icon="user"
						title="{session.device}{session.current ? ' · this device' : ''}"
						text="Signed in {formatTime(session.signedInAt)} · last active {formatTime(
							session.lastActiveAt
						)}{session.ipAddress ? ` · ${session.ipAddress}` : ''}"
					>
						{#snippet action()}
							{#if !session.current}
								<form method="POST" action="?/endSession" use:enhance>
									<input type="hidden" name="sessionId" value={session.id} />
									<Button type="submit" variant="outline" size="small">End session</Button>
								</form>
							{/if}
						{/snippet}
					</ListRow>
				{/each}
			</div>
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Recent security activity</Heading>
				<Text variant="lead">
					The latest events on your account, newest first. Times are shown in {data.timeZone.replaceAll(
						'_',
						' '
					)}.
				</Text>
			</Stack>

			{#if data.activity.length === 0}
				<Text variant="muted">Nothing has happened yet.</Text>
			{:else}
				<div>
					{#each data.activity as event, index (index)}
						<ListRow
							icon={describe(event.action).icon}
							title={describe(event.action).title}
							text="{formatTime(event.at)} · {event.device}{event.ipAddress
								? ` · ${event.ipAddress}`
								: ''}"
						/>
					{/each}
				</div>
			{/if}
		</Stack>
	</Card>
</Stack>

<style>
	.sr-only {
		position: absolute;
		width: var(--space-1);
		height: var(--space-1);
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
