<script lang="ts">
	let {
		level,
		label
	}: {
		/** 0 is empty; 4 is the strongest. */
		level: 0 | 1 | 2 | 3 | 4;
		label: string;
	} = $props();

	const steps = [1, 2, 3, 4] as const;
</script>

<div class="meter">
	<div class="bars" aria-hidden="true">
		{#each steps as step (step)}
			<span class="bar" class:filled={step <= level}></span>
		{/each}
	</div>
	<p class="label" role="status">{label}</p>
</div>

<style>
	.meter {
		margin-top: var(--space-8);
	}

	.bars {
		display: flex;
		gap: var(--space-6);
	}

	.bar {
		flex: 1;
		height: var(--height-meter);
		background: var(--color-sunken-strong);
		border-radius: var(--radius-8);
	}

	.filled {
		background: var(--color-ink);
	}

	.label {
		margin-top: var(--space-6);
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
		font-weight: var(--font-weight-bold);
	}
</style>
