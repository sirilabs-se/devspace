<script lang="ts">
	let { label }: { label?: string } = $props();
</script>

<div class="divider" role="separator">
	{#if label}{label}{/if}
</div>

<style>
	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-12);
		margin: var(--space-18) 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
	}

	.divider::before,
	.divider::after {
		flex: 1;
		border-top: var(--border-thin) solid var(--color-line-strong);
		content: '';
	}
</style>
