<script lang="ts">
	// `resolve` adds the app's base path. With many pages its types can't take the whole
	// `Pathname` union at once, so a checked page address is passed on as one member of it.
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import Icon from './Icon.svelte';

	let {
		label,
		changeHref,
		changeLabel = 'Change'
	}: {
		/** Who is signing in, e.g. their email address. */
		label: string;
		/** A page in this app where a different account can be chosen. */
		changeHref: Pathname;
		changeLabel?: string;
	} = $props();
</script>

<div class="chip">
	<span class="who"><Icon name="user" size={18} /><b>{label}</b></span>
	<a class="change" href={resolve(changeHref as '/')}>{changeLabel}</a>
</div>

<style>
	.chip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-12);
		padding: var(--space-10) var(--space-14);
		background: var(--color-sunken);
		border-radius: var(--radius-16);
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--space-8);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.change {
		flex: none;
		font-weight: var(--font-weight-semibold);
		text-decoration: underline;
		text-decoration-thickness: var(--border-medium);
		text-underline-offset: var(--focus-ring-width);
	}
</style>
