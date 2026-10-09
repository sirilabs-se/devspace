<script lang="ts">
	import type { Snippet } from 'svelte';

	let { level = 1, children }: { level?: 1 | 2 | 3; children: Snippet } = $props();
</script>

{#if level === 1}
	<h1 class="heading level-1">{@render children()}</h1>
{:else if level === 2}
	<h2 class="heading level-2">{@render children()}</h2>
{:else}
	<h3 class="heading level-3">{@render children()}</h3>
{/if}

<style>
	.level-1 {
		font-size: var(--font-size-heading-1);
		font-weight: var(--font-weight-black);
		line-height: var(--line-height-heading-1);
		letter-spacing: var(--tracking-heading-1);
	}

	.level-2 {
		font-size: var(--font-size-heading-2);
		font-weight: var(--font-weight-heavy);
		line-height: var(--line-height-heading-2);
		letter-spacing: var(--tracking-heading-2);
	}

	.level-3 {
		font-size: var(--font-size-heading-3);
		font-weight: var(--font-weight-bold);
		line-height: var(--line-height-snug);
		letter-spacing: var(--tracking-heading-3);
	}

	@media (max-width: 780px) {
		.level-1 {
			font-size: var(--font-size-heading-1-small);
		}
	}
</style>
