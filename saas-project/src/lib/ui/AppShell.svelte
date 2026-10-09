<script lang="ts">
	import type { Snippet } from 'svelte';

	let { appName, children }: { appName: string; children: Snippet } = $props();
</script>

<header class="header">
	<span class="name">{appName}</span>
</header>
<main class="main">
	{@render children()}
</main>

<style>
	.header {
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border-bottom: var(--border-width) solid var(--color-border);
	}

	.name {
		font-weight: var(--font-weight-bold);
	}

	.main {
		max-width: var(--width-content);
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
</style>
