<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		variant = 'info',
		title,
		children
	}: {
		variant?: 'info' | 'success' | 'warning' | 'danger';
		title?: string;
		children?: Snippet;
	} = $props();

	const icon = $derived(variant === 'info' ? 'info' : variant === 'success' ? 'check' : 'alert');
</script>

<div class="alert {variant}" role={variant === 'danger' ? 'alert' : 'status'}>
	<Icon name={icon} />
	<div class="content">
		{#if title}<b>{title}</b>{/if}
		{#if children}<div class="body">{@render children()}</div>{/if}
	</div>
</div>

<style>
	.alert {
		display: flex;
		gap: var(--space-12);
		padding: var(--space-14) var(--space-16);
		background: var(--color-surface);
		border: var(--border-medium) solid var(--color-line-strong);
		border-radius: var(--radius-16);
		font-size: var(--font-size-14);
	}

	.alert :global(.icon) {
		margin-top: var(--space-1);
	}

	.content {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.body {
		color: var(--color-ink-soft);
	}

	b + .body {
		margin-top: var(--space-2);
	}

	.info {
		background: var(--color-sunken);
		border-color: transparent;
	}

	.success {
		border-color: var(--color-success);
	}

	.warning {
		border-color: var(--color-warning);
		border-left-width: var(--border-accent);
	}

	.danger {
		background: var(--color-surface-error);
		border: var(--border-thick) solid var(--color-danger);
	}
</style>
