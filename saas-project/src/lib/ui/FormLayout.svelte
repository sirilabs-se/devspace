<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="form-layout">
	{@render children()}
</div>

<style>
	.form-layout {
		max-width: var(--width-form);
		margin: 0 auto;
	}
</style>
