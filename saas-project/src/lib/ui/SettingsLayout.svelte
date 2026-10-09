<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	let {
		heading,
		items,
		current,
		children
	}: {
		/** A small label above the navigation, e.g. "Account". */
		heading: string;
		items: { label: string; href: Pathname }[];
		/** The `href` of the page being shown. */
		current: string;
		children: Snippet;
	} = $props();
</script>

<div class="settings">
	<nav class="side" aria-label={heading}>
		<p class="heading">{heading}</p>
		{#each items as item (item.href)}
			<a
				href={resolve(item.href)}
				class:current={item.href === current}
				aria-current={item.href === current ? 'page' : undefined}
			>
				{item.label}
			</a>
		{/each}
	</nav>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.settings {
		display: grid;
		grid-template-columns: var(--width-settings-nav) minmax(0, 1fr);
		gap: var(--space-40);
		width: 100%;
		max-width: var(--width-settings);
		margin: 0 auto;
		padding: var(--space-32);
	}

	.side {
		position: sticky;
		top: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-self: start;
	}

	.heading {
		margin: 0 var(--space-12) var(--space-6);
		color: var(--color-ink-faint);
		font-size: var(--font-size-nav-heading);
		font-weight: var(--font-weight-bold);
		letter-spacing: var(--tracking-nav-heading);
	}

	a {
		display: flex;
		align-items: center;
		gap: var(--space-12);
		min-height: var(--size-touch);
		padding: var(--space-10) var(--space-12);
		border-radius: var(--radius-12);
		color: var(--color-ink-soft);
		font-size: var(--font-size-nav);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	a:hover {
		background: var(--color-sunken);
	}

	a.current {
		background: var(--color-ink);
		color: var(--color-surface);
	}

	.content {
		min-width: 0;
		max-width: var(--width-page-narrow);
	}

	@media (max-width: 780px) {
		.settings {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-16);
			padding: var(--space-16);
		}

		.side {
			position: static;
			flex-direction: row;
			gap: var(--space-6);
			margin: 0 calc(var(--space-16) * -1);
			padding: 0 var(--space-16) var(--space-6);
			overflow: auto;
		}

		.heading {
			display: none;
		}

		a {
			flex: none;
			padding: 0 var(--space-14);
			background: var(--color-surface);
			border: var(--border-medium) solid var(--color-line-strong);
			border-radius: var(--radius-pill);
			white-space: nowrap;
		}

		a.current {
			border-color: var(--color-ink);
		}
	}
</style>
