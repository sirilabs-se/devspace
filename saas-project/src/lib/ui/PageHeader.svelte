<script lang="ts">
	let { title, text }: { title: string; text?: string } = $props();
</script>

<header class="header">
	<h1 class="title">{title}</h1>
	{#if text}<p class="text">{text}</p>{/if}
</header>

<style>
	.header {
		margin-bottom: var(--space-24);
	}

	.title {
		font-size: var(--font-size-heading-1);
		font-weight: var(--font-weight-black);
		line-height: var(--line-height-heading-1);
		letter-spacing: var(--tracking-heading-1);
	}

	.text {
		max-width: var(--width-lead);
		margin-top: var(--space-8);
		color: var(--color-ink-muted);
	}

	@media (max-width: 780px) {
		.header {
			margin-bottom: var(--space-18);
		}

		.title {
			font-size: var(--font-size-heading-1-small);
		}
	}
</style>
