<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<section class="card">
	{@render children()}
</section>

<style>
	.card {
		padding: var(--space-4);
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius-medium);
		box-shadow: var(--shadow-raised);
	}
</style>
