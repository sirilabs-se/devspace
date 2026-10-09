<script lang="ts">
	import type { Snippet } from 'svelte';

	let { level = 1, children }: { level?: 1 | 2; children: Snippet } = $props();
</script>

{#if level === 1}
	<h1 class="heading level-1">{@render children()}</h1>
{:else}
	<h2 class="heading level-2">{@render children()}</h2>
{/if}

<style>
	.heading {
		margin: 0;
		font-weight: var(--font-weight-bold);
		line-height: var(--line-height-heading);
	}

	.level-1 {
		font-size: var(--font-size-heading-1);
	}

	.level-2 {
		font-size: var(--font-size-heading-2);
	}
</style>
