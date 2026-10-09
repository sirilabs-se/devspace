<script lang="ts">
	import type { Snippet } from 'svelte';

	let { wide = false, children }: { wide?: boolean; children: Snippet } = $props();
</script>

<div class="center">
	<div class="card" class:wide>
		{@render children()}
	</div>
</div>

<style>
	.center {
		display: grid;
		flex: 1;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		padding: var(--space-40) var(--space-20);
	}

	.card {
		width: 100%;
		min-width: 0;
		max-width: var(--width-centered-card);
		padding: var(--space-38);
		overflow-wrap: anywhere;
		background: var(--color-surface);
		border: var(--border-thin) solid var(--color-line);
		border-radius: var(--radius-28);
		box-shadow: var(--shadow-2);
	}

	.wide {
		max-width: var(--width-centered-card-wide);
	}

	@media (max-width: 780px) {
		.center {
			place-items: start center;
			padding: var(--space-20) var(--space-12);
		}

		.card {
			padding: var(--space-24) var(--space-20);
			border-radius: var(--radius-24);
		}
	}
</style>
