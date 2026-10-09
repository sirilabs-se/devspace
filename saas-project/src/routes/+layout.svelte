<script lang="ts">
	import '$lib/ui/theme.css';
	import { page } from '$app/state';
	import { AppShell, Button, Text } from '$lib/ui';

	let { data, children } = $props();

	// Sign-up, login and email verification show only the logo in their header, as in the UX prototype.
	const plainHeader = $derived(
		page.route.id === '/signup' || page.route.id === '/login' || page.route.id === '/verify-email'
	);
</script>

<AppShell appName="SaaS">
	{#snippet actions()}
		{#if data.user}
			<Text variant="muted">{data.user.name}</Text>
			<form method="POST" action="/logout">
				<Button type="submit" variant="ghost" size="small">Log out</Button>
			</form>
		{:else if !plainHeader}
			<Button href="/login" variant="ghost" size="small">Log in</Button>
			<Button href="/signup" size="small">Sign up</Button>
		{/if}
	{/snippet}
	{@render children()}
</AppShell>
