<script lang="ts">
	import '$lib/ui/theme.css';
	import { page } from '$app/state';
	import { AppShell, Button } from '$lib/ui';

	let { data, children } = $props();

	// Sign-up, login and email verification show only the logo in their header, as in the UX prototype.
	const plainHeader = $derived(
		['/signup', '/login', '/verify-email', '/forgot-password', '/reset-password'].includes(
			page.route.id ?? ''
		)
	);
</script>

<AppShell appName="SaaS">
	{#snippet actions()}
		{#if data.user}
			<Button href="/settings/account" variant="ghost" size="small">{data.user.name}</Button>
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
