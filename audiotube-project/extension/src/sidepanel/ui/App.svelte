<script lang="ts">
	import { untrack } from 'svelte';
	import type { AudioOnlyController } from '../core';
	import AudioOnlyCard from './AudioOnlyCard.svelte';
	import Logo from './Logo.svelte';

	let { audioOnly }: { audioOnly: AudioOnlyController } = $props();

	let view = $state(untrack(() => audioOnly.get()));
	$effect(() => audioOnly.subscribe((next) => (view = next)));

	const messages = {
		'save-failed': "Couldn't save that change. Audio only is back to its saved setting.",
		'load-failed': "Couldn't read your saved setting. Showing the default."
	};
</script>

<div class="flex min-h-screen flex-col bg-surface font-sans text-sm text-text">
	<header class="flex h-13 items-center gap-2.5 px-3.5">
		<Logo />
		<span class="text-lg">AudioTube</span>
	</header>
	<main class="flex flex-col gap-3 p-3.5">
		{#if view.ready}
			<AudioOnlyCard
				checked={view.audioOnly}
				lowestQuality={view.saveBandwidth}
				onToggle={audioOnly.toggle}
			/>
		{/if}
		{#if view.error}
			<p role="alert" class="m-0 rounded-card bg-card px-3.5 py-2.5 text-xs text-error">
				{messages[view.error]}
			</p>
		{/if}
	</main>
</div>
