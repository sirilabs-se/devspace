<script lang="ts">
	import { Button, Card, Heading, ListRow, PageHeader, Stack, Text } from '$lib/ui';

	let { data } = $props();

	const documents: Record<string, string> = {
		terms: 'Terms of service',
		privacy: 'Privacy policy',
		age_confirmation: 'Confirmation of being 18 or older'
	};
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
	<title>Privacy · SaaS</title>
</svelte:head>

<PageHeader title="Privacy" text="What you agreed to, and a copy of the data we hold about you." />

<Stack gap="large">
	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>What you accepted</Heading>
				<Text variant="lead">The version of each document you agreed to, and when.</Text>
			</Stack>
			{#if data.consents.length === 0}
				<Text variant="muted">Nothing has been recorded yet.</Text>
			{:else}
				<div>
					{#each data.consents as consent, index (index)}
						<ListRow
							icon="check"
							title={documents[consent.document] ?? consent.document}
							text="Version {consent.version} · accepted {formatTime(consent.acceptedAt)}"
						/>
					{/each}
				</div>
			{/if}
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Download my data</Heading>
				<Text variant="lead">
					A file with your profile, preferences, ways of signing in, sessions, what you accepted and
					your security history. It contains no passwords or other secrets.
				</Text>
			</Stack>
			<form method="GET" action="/settings/privacy/export">
				<Button type="submit" variant="outline">Download my data</Button>
			</form>
			<Text variant="muted">
				To delete your account and its data, use “Delete account” in your account settings.
			</Text>
		</Stack>
	</Card>
</Stack>
