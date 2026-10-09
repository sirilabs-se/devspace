<script lang="ts">
	import { Card, Heading, PageWrap, Stack, Text } from '$lib/ui';

	let { data } = $props();
</script>

<svelte:head>
	<title>SaaS</title>
</svelte:head>

<PageWrap narrow>
	<Card>
		<Stack>
			{#if data.user}
				<Heading>Welcome, {data.user.name}</Heading>
				<Text variant="lead">You’re signed in. Features arrive with the next tasks.</Text>
			{:else}
				<Heading>SaaS</Heading>
				<Text variant="lead">The app is set up. Features arrive with the next tasks.</Text>
			{/if}
			<Text variant="muted">This is a placeholder page.</Text>
		</Stack>
	</Card>
</PageWrap>
