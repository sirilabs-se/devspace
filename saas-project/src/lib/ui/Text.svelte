<script lang="ts">
	import type { Snippet } from 'svelte';

	let { variant = 'body', children }: { variant?: 'body' | 'muted'; children: Snippet } = $props();
</script>

<p class="text {variant}">{@render children()}</p>

<style>
	.text {
		margin: 0;
	}

	.muted {
		color: var(--color-text-muted);
		font-size: var(--font-size-small);
	}
</style>
