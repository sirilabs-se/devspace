<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	let {
		name,
		href = '/',
		inverse = false
	}: {
		name: string;
		/** A page in this app. */
		href?: Pathname;
		/** For use on a dark background. */
		inverse?: boolean;
	} = $props();
</script>

<a class="logo" class:inverse href={resolve(href)}>
	<span class="mark" aria-hidden="true"></span>
	<span>{name}</span>
</a>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: var(--space-10);
		min-height: var(--size-touch);
		font-size: var(--font-size-18);
		font-weight: var(--font-weight-black);
		letter-spacing: var(--tracking-logo);
		text-decoration: none;
	}

	.inverse {
		color: var(--color-hero-ink);
	}

	.inverse:focus-visible {
		outline-color: var(--color-hero-ink);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-logo-mark);
		height: var(--size-logo-mark);
		background: var(--gradient-mark);
		border-radius: var(--radius-12);
	}

	.mark::after {
		width: var(--size-logo-dot);
		height: var(--size-logo-dot);
		background: var(--color-surface);
		border-radius: var(--radius-round);
		content: '';
	}
</style>
