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
	const variant = $derived(level <= 1 ? 'weak' : level === 2 ? 'fair' : 'strong');
</script>

<div class="meter {variant}">
	<div class="bars" aria-hidden="true">
		{#each steps as step (step)}
			<span class="bar" class:filled={step <= level}></span>
		{/each}
	</div>
	<span class="label" role="status">{label}</span>
</div>

<style>
	.meter {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.bars {
		display: flex;
		gap: var(--space-1);
	}

	.bar {
		flex: 1;
		height: var(--meter-height);
		background: var(--color-border);
		border-radius: var(--radius-small);
	}

	.weak .filled {
		background: var(--color-danger);
	}

	.fair .filled {
		background: var(--color-warning);
	}

	.strong .filled {
		background: var(--color-success);
	}

	.label {
		color: var(--color-text-muted);
		font-size: var(--font-size-small);
	}
</style>
