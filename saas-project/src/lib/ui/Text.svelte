<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'body',
		children
	}: {
		/** "lead" sits under a heading; "footnote" is small, centred text under a form. */
		variant?: 'body' | 'lead' | 'muted' | 'footnote';
		children: Snippet;
	} = $props();
</script>

<p class="text {variant}">{@render children()}</p>

<style>
	.lead {
		max-width: var(--width-lead);
		color: var(--color-ink-muted);
	}

	.muted {
		color: var(--color-ink-muted);
		font-size: var(--font-size-14);
	}

	.footnote {
		overflow-wrap: anywhere;
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
		text-align: center;
	}
</style>
