<script lang="ts">
	import type { Snippet } from 'svelte';

	let { narrow = false, children }: { narrow?: boolean; children: Snippet } = $props();
</script>

<div class="wrap" class:narrow>
	{@render children()}
</div>

<style>
	.wrap {
		width: 100%;
		max-width: var(--width-page);
		margin: 0 auto;
		padding: var(--space-32);
	}

	.narrow {
		max-width: var(--width-page-narrow);
	}

	@media (max-width: 780px) {
		.wrap {
			padding: var(--space-16);
		}
	}
</style>
