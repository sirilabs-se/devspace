<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Card, ListRow, PageHeader, Stack, TextLink } from '$lib/ui';

	let { data, form } = $props();

	const names: Record<string, string> = { google: 'Google', facebook: 'Facebook' };
	const errors: Record<string, string> = {
		last_method:
			'This is your only way to sign in, so it can’t be disconnected. Set a password first, then try again.',
		not_connected: 'That account isn’t connected.',
		unavailable: 'That provider isn’t available right now.'
	};

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
</script>

<svelte:head>
	<title>Connected accounts · SaaS</title>
</svelte:head>

<PageHeader
	title="Connected accounts"
	text="Sign in with Google or Facebook as well as, or instead of, your password."
/>

<Stack gap="large">
	{#if form?.disconnected}
		<Alert variant="success" title="Disconnected" />
	{:else if form?.error}
		<Alert variant="danger" title="That didn’t work">
			{errors[form.error]}
			{#if form.error === 'last_method'}
				<TextLink href="/settings/account">Set a password</TextLink>
			{/if}
		</Alert>
	{:else if data.connectError}
		<Alert variant="danger" title="Connecting didn’t finish">
			It was cancelled, or that account is already connected to someone else. Nothing has changed.
		</Alert>
	{:else if data.justConnected && names[data.justConnected]}
		<Alert variant="success" title="{names[data.justConnected]} connected">
			You can now sign in with it.
		</Alert>
	{/if}

	<Card>
		<ListRow
			icon="user"
			title="Password"
			text={data.hasPassword ? 'You can sign in with your email and password.' : 'Not set.'}
		>
			{#snippet action()}
				<Button href="/settings/account" variant="outline" size="small">
					{data.hasPassword ? 'Change' : 'Set a password'}
				</Button>
			{/snippet}
		</ListRow>

		{#each data.providers as entry (entry.provider)}
			<ListRow
				icon="link"
				title={names[entry.provider]}
				text={entry.connected && entry.connectedAt
					? `Connected on ${formatDate(entry.connectedAt)}`
					: 'Not connected'}
			>
				{#snippet action()}
					<form method="POST" action={entry.connected ? '?/disconnect' : '?/connect'} use:enhance>
						<input type="hidden" name="provider" value={entry.provider} />
						<Button type="submit" variant={entry.connected ? 'ghost' : 'outline'} size="small">
							{entry.connected ? 'Disconnect' : 'Connect'}
						</Button>
					</form>
				{/snippet}
			</ListRow>
		{/each}
	</Card>

	{#if data.providers.length === 0}
		<Alert variant="info" title="No providers are available">
			Signing in with Google or Facebook isn’t switched on.
		</Alert>
	{/if}
</Stack>
