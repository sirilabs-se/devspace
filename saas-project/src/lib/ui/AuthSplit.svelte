<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from './Logo.svelte';

	let {
		appName,
		headline,
		text,
		aside,
		children
	}: {
		appName: string;
		/** The large line on the dark panel. */
		headline: string;
		/** A supporting sentence under the headline. Hidden on small screens. */
		text?: string;
		/** Extra content on the dark panel, e.g. a list of benefits. Hidden on small screens. */
		aside?: Snippet;
		/** The form or message. */
		children: Snippet;
	} = $props();
</script>

<div class="auth">
	<aside class="hero">
		<div><Logo name={appName} inverse /></div>
		{#if aside}
			<div class="extra">{@render aside()}</div>
		{/if}
		<div>
			<p class="headline">{headline}</p>
			{#if text}
				<p class="text">{text}</p>
			{/if}
		</div>
	</aside>
	<section class="form">
		<div class="card">
			{@render children()}
		</div>
	</section>
</div>

<style>
	.auth {
		display: grid;
		flex: 1;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
	}

	.hero {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--space-24);
		padding: var(--space-44);
		overflow: hidden;
		background: var(--gradient-hero), var(--color-hero);
		color: var(--color-hero-ink);
	}

	.hero::after {
		position: absolute;
		inset: 0;
		background: var(--gradient-hero-shade);
		content: '';
	}

	.hero > * {
		position: relative;
		z-index: 1;
	}

	.hero :global(:focus-visible) {
		outline-color: var(--color-hero-ink);
	}

	.headline {
		font-size: var(--font-size-display);
		font-weight: var(--font-weight-black);
		line-height: var(--line-height-display);
		letter-spacing: var(--tracking-display);
	}

	.text {
		max-width: var(--width-hero-text);
		margin-top: var(--space-14);
		color: var(--color-hero-ink-soft);
		font-size: var(--font-size-17);
	}

	.form {
		display: grid;
		place-items: center;
		padding: var(--space-40);
		background: var(--color-background);
	}

	.card {
		width: 100%;
		min-width: 0;
		max-width: var(--width-auth-form);
		overflow-wrap: anywhere;
	}

	@media (max-width: 780px) {
		.auth {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
		}

		.hero {
			padding: var(--space-20);
		}

		.headline {
			font-size: var(--font-size-display-small);
		}

		.text,
		.extra {
			display: none;
		}

		.form {
			place-items: start center;
			padding: var(--space-22) var(--space-16) var(--space-36);
		}
	}
</style>
