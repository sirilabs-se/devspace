<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'raised',
		children
	}: { variant?: 'raised' | 'sunken' | 'flat'; children: Snippet } = $props();
</script>

<section class="card {variant}">
	{@render children()}
</section>

<style>
	.card {
		min-width: 0;
		padding: var(--space-24);
		overflow-wrap: anywhere;
		background: var(--color-surface);
		border: var(--border-thin) solid var(--color-line);
		border-radius: var(--radius-22);
		box-shadow: var(--shadow-1);
	}

	.sunken {
		background: var(--color-sunken);
		border-color: transparent;
		box-shadow: none;
	}

	.flat {
		box-shadow: none;
	}

	@media (max-width: 780px) {
		.card {
			padding: var(--space-18);
			border-radius: var(--radius-20);
		}
	}
</style>
