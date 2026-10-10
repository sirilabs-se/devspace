<script lang="ts">
	import { Button, Card, ListRow, PageHeader, SelectField, Stack, Text, TextField } from '$lib/ui';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let user = $state(data.filters.user);
	// svelte-ignore state_referenced_locally
	let action = $state(data.filters.action);
	// svelte-ignore state_referenced_locally
	let from = $state(data.filters.from);
	// svelte-ignore state_referenced_locally
	let to = $state(data.filters.to);

	const readable = (name: string) => name.replaceAll('_', ' ');
	const formatTime = (iso: string) =>
		new Date(iso).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
			timeZone: 'UTC'
		});
	const who = (person: { name: string; email: string } | null, missing: string) =>
		person ? `${person.name} <${person.email}>` : missing;
</script>

<svelte:head>
	<title>Audit log · Admin · SaaS</title>
</svelte:head>

<PageHeader
	title="Audit log"
	text="Security events and admin actions, newest first. Entries can’t be edited or deleted. Times are in UTC."
/>

<Stack gap="large">
	<Card>
		<form method="GET">
			<Stack gap="large">
				<Stack gap="fields">
					<TextField
						label="Person"
						name="user"
						placeholder="Part of an email, name or username"
						bind:value={user}
					/>
					<SelectField
						label="Action"
						name="action"
						bind:value={action}
						options={[
							{ value: '', label: 'All actions' },
							...data.actions.map((name) => ({ value: name, label: readable(name) }))
						]}
					/>
					<TextField label="From" name="from" type="date" bind:value={from} />
					<TextField label="To" name="to" type="date" bind:value={to} />
				</Stack>
				<Stack gap="small">
					<div><Button type="submit">Apply filters</Button></div>
					<div>
						<Button type="submit" variant="outline" formaction="/admin/audit/export">
							Download as CSV
						</Button>
					</div>
				</Stack>
			</Stack>
		</form>
	</Card>

	<Card>
		<Stack gap="large">
			<Text variant="muted">
				{data.total}
				{data.total === 1 ? 'entry' : 'entries'} · page {data.page} of {data.pageCount}
			</Text>

			{#if data.entries.length === 0}
				<Text>No entries match these filters.</Text>
			{:else}
				<div>
					{#each data.entries as entry (entry.id)}
						<ListRow
							title={readable(entry.action)}
							text="{formatTime(entry.at)} · by {who(entry.actor, 'nobody signed in')} · about {who(
								entry.subject,
								'no account'
							)} · {entry.device}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}{entry.details
								? ` · ${JSON.stringify(entry.details)}`
								: ''}"
						/>
					{/each}
				</div>
			{/if}

			{#if data.pageCount > 1}
				<form method="GET">
					<input type="hidden" name="user" value={data.filters.user} />
					<input type="hidden" name="action" value={data.filters.action} />
					<input type="hidden" name="from" value={data.filters.from} />
					<input type="hidden" name="to" value={data.filters.to} />
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
