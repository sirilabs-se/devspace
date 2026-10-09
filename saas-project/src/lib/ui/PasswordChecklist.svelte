<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		summary,
		rules
	}: {
		/** A one- or two-word verdict, e.g. "Fair". */
		summary: string;
		rules: { label: string; met: boolean }[];
	} = $props();

	const metCount = $derived(rules.filter((rule) => rule.met).length);
</script>

<div class="checklist">
	<div class="bars" aria-hidden="true">
		{#each rules as rule, index (rule.label)}
			<span class="bar" class:filled={index < metCount}></span>
		{/each}
	</div>
	<p class="summary" aria-live="polite">{summary}</p>
	<ul class="rules">
		{#each rules as rule (rule.label)}
			<li class:met={rule.met}>
				<Icon name={rule.met ? 'check' : 'x'} size={13} />
				<span>{rule.label}<span class="state">{rule.met ? ': met' : ': not met'}</span></span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.checklist {
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

	.summary {
		margin-top: var(--space-6);
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
		font-weight: var(--font-weight-bold);
	}

	.rules {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4) var(--space-12);
		margin: var(--space-8) 0 0;
		padding: 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--space-6);
	}

	.met {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	/* Read out by screen readers; the icon carries the meaning visually. */
	.state {
		position: absolute;
		width: var(--space-1);
		height: var(--space-1);
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 780px) {
		.rules {
			grid-template-columns: 1fr;
		}
	}
</style>
