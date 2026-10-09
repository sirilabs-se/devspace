<script lang="ts">
	import type { Snippet } from 'svelte';

	let { gap = 'medium', children }: { gap?: 'small' | 'medium' | 'large'; children: Snippet } =
		$props();
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
		gap: var(--space-2);
	}

	.medium {
		gap: var(--space-3);
	}

	.large {
		gap: var(--space-4);
	}
</style>
