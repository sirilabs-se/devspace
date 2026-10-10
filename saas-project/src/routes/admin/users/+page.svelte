<script lang="ts">
	import { Button, Card, ListRow, PageHeader, Stack, Text, TextField } from '$lib/ui';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let query = $state(data.query);

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
</script>

<svelte:head>
	<title>Users · Admin · SaaS</title>
</svelte:head>

<PageHeader title="Users" text="Find a person by their email, name or username." />

<Stack gap="large">
	<Card>
		<form method="GET">
			<Stack gap="medium">
				<TextField label="Search" name="q" placeholder="maya@example.com" bind:value={query} />
				<div><Button type="submit">Search</Button></div>
			</Stack>
		</form>
	</Card>

	<Card>
		<Stack gap="large">
			<Text variant="muted">
				{data.total}
				{data.total === 1 ? 'person' : 'people'}{data.query ? ` matching “${data.query}”` : ''} · page
				{data.page} of {data.pageCount}
			</Text>

			{#if data.users.length === 0}
				<Text>Nobody matches that search.</Text>
			{:else}
				<div>
					{#each data.users as user (user.id)}
						<ListRow
							icon="user"
							title="{user.name}{user.role === 'admin' ? ' · admin' : ''}{user.suspended
								? ' · suspended'
								: ''}"
							text="{user.email}{user.username ? ` · @${user.username}` : ''} · joined {formatDate(
								user.createdAt
							)}{user.emailVerified ? '' : ' · email not verified'}"
						>
							{#snippet action()}
								<Button href="/admin/users/{user.id}" variant="outline" size="small">
									Open<span class="sr-only"> {user.name}</span>
								</Button>
							{/snippet}
						</ListRow>
					{/each}
				</div>
			{/if}

			{#if data.pageCount > 1}
				<form method="GET">
					<input type="hidden" name="q" value={data.query} />
					<Stack gap="small">
						{#if data.page > 1}
							<div>
								<Button type="submit" variant="ghost" name="page" value={String(data.page - 1)}>
									Previous page
								</Button>
							</div>
						{/if}
						{#if data.page < data.pageCount}
							<div>
								<Button type="submit" variant="ghost" name="page" value={String(data.page + 1)}>
									Next page
								</Button>
							</div>
						{/if}
					</Stack>
				</form>
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
