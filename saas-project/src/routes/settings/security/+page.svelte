<script lang="ts">
	import { Button, Card, Heading, PageHeader, Stack, Text } from '$lib/ui';
</script>

<svelte:head>
	<title>Security · SaaS</title>
</svelte:head>

<PageHeader title="Security" text="Control where your account is signed in." />

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
