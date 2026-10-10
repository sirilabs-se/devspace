<script lang="ts">
	import type { Snippet } from 'svelte';
	// `resolve` adds the app's base path. With many pages its types can't take the whole
	// `Pathname` union at once, so a checked page address is passed on as one member of it.
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	/** `href` is a page in this app. */
	let { href, children }: { href: Pathname; children: Snippet } = $props();
</script>

<a class="link" href={resolve(href as '/')}>{@render children()}</a>

<style>
	.link {
		display: inline-block;
		margin: calc(var(--space-6) * -1) calc(var(--space-2) * -1);
		padding: var(--space-6) var(--space-2);
		font-weight: var(--font-weight-semibold);
		text-decoration: underline;
		text-decoration-thickness: var(--border-medium);
		text-underline-offset: var(--focus-ring-width);
	}
</style>
