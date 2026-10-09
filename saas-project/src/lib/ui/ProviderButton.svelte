<script lang="ts">
	let {
		name = 'provider',
		value,
		label
	}: {
		/** The form field name and value sent when this button is pressed. */
		name?: string;
		value: string;
		/** e.g. "Continue with Google". Its last word's first letter is shown as a badge. */
		label: string;
	} = $props();

	const badge = $derived(label.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '');
</script>

<button class="provider" type="submit" {name} {value}>
	<span class="badge" aria-hidden="true">{badge}</span>
	<span>{label}</span>
</button>

<style>
	.provider {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-8);
		width: 100%;
		min-height: var(--height-control);
		padding: var(--space-10) var(--space-22);
		background: var(--color-surface);
		border: var(--border-medium) solid var(--color-ink);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-15);
		font-weight: var(--font-weight-semibold);
		transition:
			background var(--duration-normal),
			color var(--duration-normal);
	}

	.provider:hover {
		background: var(--color-ink);
		color: var(--color-surface);
	}

	.badge {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-checkbox);
		height: var(--size-checkbox);
		background: var(--color-ink);
		border-radius: var(--radius-round);
		color: var(--color-surface);
		font-size: var(--font-size-12);
		font-weight: var(--font-weight-black);
	}

	.provider:hover .badge {
		background: var(--color-surface);
		color: var(--color-ink);
	}
</style>
