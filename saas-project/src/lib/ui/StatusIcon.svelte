<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	let {
		icon,
		variant = 'neutral'
	}: {
		icon: IconName;
		/** "strong" for success, "pending" for waiting or expired, "danger" for a problem. */
		variant?: 'neutral' | 'strong' | 'pending' | 'danger';
	} = $props();
</script>

<div class="status-icon {variant}">
	<Icon name={icon} size={30} />
</div>

<style>
	.status-icon {
		display: grid;
		place-items: center;
		width: var(--size-status-icon);
		height: var(--size-status-icon);
		margin-bottom: var(--space-20);
		background: var(--color-sunken);
		border-radius: var(--radius-22);
	}

	.strong {
		background: var(--color-ink);
		color: var(--color-surface);
	}

	.pending {
		background: var(--color-surface);
		border: var(--border-thick) dashed var(--color-ink-muted);
	}

	.danger {
		background: var(--color-danger);
		color: var(--color-danger-ink);
	}
</style>
