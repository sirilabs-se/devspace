<script lang="ts">
	import '$lib/ui/theme.css';
	import { page } from '$app/state';
	import { AppShell, Button } from '$lib/ui';

	let { children } = $props();

	// Sign-up shows only the logo in its header, as in the UX prototype.
	const onSignUp = $derived(page.route.id === '/signup');
</script>

<AppShell appName="SaaS">
	{#snippet actions()}
		{#if !onSignUp}
			<Button href="/signup" size="small">Sign up</Button>
		{/if}
	{/snippet}
	{@render children()}
</AppShell>
