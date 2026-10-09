<script lang="ts">
	import { Button, Card, Heading, ListRow, PageHeader, Stack, Text } from '$lib/ui';
	import type { IconName } from '$lib/ui';

	let { data } = $props();

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
		provider_unlinked: { title: 'Sign-in provider disconnected', icon: 'link' }
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
