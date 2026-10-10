<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	let {
		type = 'button',
		href,
		variant = 'primary',
		size = 'medium',
		fullWidth = false,
		disabled = false,
		loading = false,
		onclick,
		children
	}: {
		type?: 'button' | 'submit';
		/** A page in this app. Set to make this a link that looks like a button. */
		href?: Pathname;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'small' | 'medium' | 'large';
		fullWidth?: boolean;
		disabled?: boolean;
		/** Shows a spinner and blocks further presses. */
		loading?: boolean;
		/** Called when the button is pressed. Not used for links. */
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a class="button {variant} {size}" class:full={fullWidth} href={resolve(href)}>
		<span>{@render children()}</span>
	</a>
{:else}
	<button
		class="button {variant} {size}"
		class:full={fullWidth}
		class:loading
		{type}
		{onclick}
		disabled={disabled || loading}
		aria-busy={loading ? 'true' : undefined}
	>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		<span>{@render children()}</span>
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-8);
		max-width: 100%;
		height: var(--height-control);
		padding: 0 var(--space-22);
		background: none;
		border: var(--border-medium) solid transparent;
		border-radius: var(--radius-pill);
		font-size: var(--font-size-15);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		white-space: nowrap;
		transition:
			transform var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-slow),
			background var(--duration-normal),
			color var(--duration-normal);
	}

	.button:active {
		transform: scale(0.97);
	}

	.small {
		height: var(--height-control-small);
		padding: 0 var(--space-16);
		font-size: var(--font-size-14);
	}

	.large {
		height: var(--height-control-large);
		padding: 0 var(--space-30);
		font-size: var(--font-size-16);
	}

	.full {
		width: 100%;
	}

	.primary {
		background: var(--color-brand);
		color: var(--color-brand-ink);
	}

	.primary:hover {
		box-shadow: var(--shadow-button-hover);
		transform: translateY(var(--lift-hover));
	}

	.secondary {
		background: var(--color-sunken);
		color: var(--color-ink);
	}

	.secondary:hover {
		background: var(--color-sunken-strong);
	}

	.outline {
		background: var(--color-surface);
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	.outline:hover {
		background: var(--color-ink);
		color: var(--color-surface);
	}

	.ghost {
		color: var(--color-ink);
	}

	.ghost:hover {
		background: var(--color-sunken);
	}

	.danger {
		background: var(--color-surface);
		border: var(--border-thick) solid var(--color-danger);
		color: var(--color-danger);
	}

	.danger:hover {
		background: var(--color-danger);
		color: var(--color-danger-ink);
	}

	.button:disabled {
		box-shadow: none;
		cursor: not-allowed;
		opacity: 45%;
		transform: none;
	}

	.button.loading {
		opacity: 90%;
	}

	.spinner {
		display: inline-block;
		flex: none;
		width: var(--size-spinner);
		height: var(--size-spinner);
		border: var(--border-heavy) solid currentcolor;
		border-right-color: transparent;
		border-radius: var(--radius-round);
		animation: spin var(--duration-spin) linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 780px) {
		.button {
			height: auto;
			min-height: var(--height-control);
			padding-top: var(--space-10);
			padding-bottom: var(--space-10);
			line-height: var(--line-height-snug);
			text-align: center;
			white-space: normal;
		}

		.small {
			min-height: var(--size-touch);
		}

		.large {
			min-height: var(--height-control-large);
		}
	}
</style>
