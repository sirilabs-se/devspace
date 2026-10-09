<script lang="ts">
	import '$lib/ui/theme.css';
	import { AppShell } from '$lib/ui';

	let { children } = $props();
</script>

<AppShell appName="SaaS">
	{@render children()}
</AppShell>
