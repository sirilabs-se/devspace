<script lang="ts">
	let { codes, label }: { codes: string[]; label: string } = $props();
</script>

<ul class="codes" aria-label={label}>
	{#each codes as code (code)}
		<li>{code}</li>
	{/each}
</ul>

<style>
	.codes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-8) var(--space-16);
		margin: 0;
		padding: var(--space-16);
		background: var(--color-sunken);
		border-radius: var(--radius-14);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-15);
		list-style: none;
	}

	@media (max-width: 780px) {
		.codes {
			grid-template-columns: 1fr;
		}
	}
</style>
