<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'info',
		children
	}: { variant?: 'info' | 'success' | 'danger'; children: Snippet } = $props();
</script>

<div class="notice {variant}" role={variant === 'danger' ? 'alert' : 'status'}>
	{@render children()}
</div>

<style>
	.notice {
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
		border-left: var(--space-1) solid var(--color-accent);
		border-radius: var(--radius-small);
	}

	.success {
		border-left-color: var(--color-success);
	}

	.danger {
		border-left-color: var(--color-danger);
	}
</style>
