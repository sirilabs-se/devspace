<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	let { items }: { items: { icon: IconName; text: string }[] } = $props();
</script>

<ul class="benefits">
	{#each items as item (item.text)}
		<li>
			<span class="chip"><Icon name={item.icon} /></span>
			{item.text}
		</li>
	{/each}
</ul>

<style>
	.benefits {
		display: flex;
		flex-direction: column;
		gap: var(--space-14);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--space-12);
		font-size: var(--font-size-18);
		font-weight: var(--font-weight-semibold);
	}

	.chip {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-icon-box);
		height: var(--size-icon-box);
		background: var(--color-hero-chip);
		border-radius: var(--radius-14);
	}
</style>
