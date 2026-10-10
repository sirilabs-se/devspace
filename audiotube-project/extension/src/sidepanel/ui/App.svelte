<script lang="ts">
	import { untrack } from 'svelte';
	import type { AudioOnlyController, CoverStatusController, NowPlayingController } from '../core';
	import AudioOnlyCard from './AudioOnlyCard.svelte';
	import Logo from './Logo.svelte';
	import NowPlayingCard from './NowPlayingCard.svelte';

	let {
		audioOnly,
		coverStatus,
		nowPlaying
	}: {
		audioOnly: AudioOnlyController;
		coverStatus: CoverStatusController;
		nowPlaying: NowPlayingController;
	} = $props();

	let view = $state(untrack(() => audioOnly.get()));
	$effect(() => audioOnly.subscribe((next) => (view = next)));

	let cover = $state(untrack(() => coverStatus.get()));
	$effect(() => coverStatus.subscribe((next) => (cover = next)));

	let playing = $state(untrack(() => nowPlaying.get()));
	$effect(() => nowPlaying.subscribe((next) => (playing = next)));

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
		<NowPlayingCard
			view={playing}
			onTogglePlayPause={nowPlaying.togglePlayPause}
			onGoToVideo={nowPlaying.goToVideo}
			onResume={nowPlaying.resume}
		/>
		{#if cover.coverFailed}
			<p role="status" class="m-0 rounded-card bg-card px-3.5 py-2.5 text-xs text-muted">
				Couldn't cover YouTube's player on this page
			</p>
		{/if}
		{#if view.error}
			<p role="alert" class="m-0 rounded-card bg-card px-3.5 py-2.5 text-xs text-error">
				{messages[view.error]}
			</p>
		{/if}
	</main>
</div>
