<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		gap = 'medium',
		children
	}: {
		/** "fields" is the spacing between form fields. */
		gap?: 'none' | 'small' | 'medium' | 'fields' | 'large';
		children: Snippet;
	} = $props();
</script>

<div class="stack {gap}">
	{@render children()}
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
	}

	.small {
		gap: var(--space-8);
	}

	.medium {
		gap: var(--space-12);
	}

	.fields {
		gap: var(--space-16);
	}

	.large {
		gap: var(--space-24);
	}
</style>
