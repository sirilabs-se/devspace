<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		icon,
		title,
		text,
		action
	}: {
		icon?: IconName;
		title: string;
		/** A line of detail under the title. */
		text?: string;
		/** A button or badge at the right. */
		action?: Snippet;
	} = $props();
</script>

<div class="row">
	{#if icon}<span class="icon-box"><Icon name={icon} /></span>{/if}
	<div class="body">
		<b>{title}</b>
		{#if text}<p class="text">{text}</p>{/if}
	</div>
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-14);
		padding: var(--space-14) 0;
		border-top: var(--border-thin) solid var(--color-line);
	}

	.row:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.row:last-child {
		padding-bottom: 0;
	}

	.icon-box {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-icon-box);
		height: var(--size-icon-box);
		background: var(--color-sunken);
		border-radius: var(--radius-14);
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.text {
		color: var(--color-ink-muted);
		font-size: var(--font-size-14);
	}

	.action {
		flex: none;
	}
</style>
