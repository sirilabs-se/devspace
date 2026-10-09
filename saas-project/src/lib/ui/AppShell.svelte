<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from './Logo.svelte';

	let {
		appName,
		actions,
		children
	}: {
		appName: string;
		/** Links or buttons shown at the right of the header. */
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="shell">
	<a class="skip" href="#main">Skip to main content</a>
	<header class="nav">
		<Logo name={appName} />
		<span class="spacer"></span>
		{#if actions}
			{@render actions()}
		{/if}
	</header>
	<main class="main" id="main" tabindex="-1">
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	.skip {
		position: absolute;
		top: var(--skip-link-hidden);
		left: var(--space-12);
		z-index: 100;
		padding: var(--space-10) var(--space-16);
		background: var(--color-surface);
		border: var(--border-thick) solid var(--color-ink);
		border-radius: var(--radius-12);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
	}

	.skip:focus {
		top: var(--space-10);
	}

	.nav {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--space-10);
		height: var(--height-nav);
		padding: 0 var(--space-24);
		background: var(--color-surface-nav);
		border-bottom: var(--border-thin) solid var(--color-line);
		backdrop-filter: blur(var(--blur-nav));
	}

	.spacer {
		flex: 1;
	}

	.main {
		display: flex;
		flex: 1;
		flex-direction: column;
	}

	.main:focus {
		outline: none;
	}

	@media (max-width: 780px) {
		.nav {
			padding: 0 var(--space-16);
		}
	}
</style>
