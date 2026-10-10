<script lang="ts">
	import { Alert, Button, Card, Heading, ListRow, PageHeader, Stack, Text } from '$lib/ui';

	let { data } = $props();

	const user = $derived(data.user);

	const formatTime = (iso: string) =>
		new Date(iso).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'UTC'
		});
	const signInMethods = $derived(
		[
			user.hasPassword ? 'password' : null,
			...user.providers,
			user.passkeyCount > 0
				? `${user.passkeyCount} ${user.passkeyCount === 1 ? 'passkey' : 'passkeys'}`
				: null
		]
			.filter(Boolean)
			.join(', ')
	);
	// The same words the person sees for their own activity would need the same list;
	// here the recorded name is shown, which is what an admin searches the audit log by.
	const readable = (action: string) => action.replaceAll('_', ' ');
</script>

<svelte:head>
	<title>{user.name} · Admin · SaaS</title>
</svelte:head>

<PageHeader title={user.name} text={user.email} />

<Stack gap="large">
	<div><Button href="/admin/users" variant="ghost" size="small">Back to users</Button></div>

	{#if user.suspended}
		<Alert variant="danger" title="This account is suspended">
			{user.suspensionReason ?? 'No reason was recorded.'}
		</Alert>
	{/if}
	{#if user.deletionRequestedAt}
		<Alert variant="warning" title="Deletion requested">
			This person asked to delete their account on {formatTime(user.deletionRequestedAt)} (UTC).
		</Alert>
	{/if}

	<Card>
		<Stack gap="large">
			<Heading level={2}>Account</Heading>
			<div>
				<ListRow title="Role" text={user.role === 'admin' ? 'Admin' : 'User'} />
				<ListRow title="Username" text={user.username ? `@${user.username}` : 'None'} />
				<ListRow title="Email verified" text={user.emailVerified ? 'Yes' : 'No'} />
				<ListRow title="Joined" text="{formatTime(user.createdAt)} (UTC)" />
				<ListRow title="Ways to sign in" text={signInMethods || 'None'} />
				<ListRow title="Two-step verification" text={user.twoStepOn ? 'On' : 'Off'} />
			</div>
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Recent security events</Heading>
				<Text variant="lead">The latest 20, newest first. Times are in UTC.</Text>
			</Stack>
			{#if user.recentActivity.length === 0}
				<Text variant="muted">Nothing has happened yet.</Text>
			{:else}
				<div>
					{#each user.recentActivity as event, index (index)}
						<ListRow
							title={readable(event.action)}
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
