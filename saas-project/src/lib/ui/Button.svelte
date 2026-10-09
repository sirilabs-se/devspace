<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'button',
		variant = 'primary',
		disabled = false,
		children
	}: {
		type?: 'button' | 'submit';
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
		children: Snippet;
	} = $props();
</script>

<button class="button {variant}" {type} {disabled}>
	{@render children()}
</button>

<style>
	.button {
		padding: var(--space-2) var(--space-4);
		border: var(--border-width) solid var(--color-accent);
		border-radius: var(--radius-small);
		font-family: inherit;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.primary {
		background: var(--color-accent);
		color: var(--color-accent-text);
	}

	.secondary {
		background: var(--color-surface);
		color: var(--color-accent);
	}

	.button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-accent);
		outline-offset: var(--focus-ring-width);
	}

	.button:disabled {
		opacity: 60%;
		cursor: not-allowed;
	}
</style>
