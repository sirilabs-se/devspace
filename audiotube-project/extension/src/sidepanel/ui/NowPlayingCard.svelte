<script lang="ts">
	import type { NowPlayingView } from '../core';
	import Icon from './Icon.svelte';
	import { PAUSE, PLAY } from './icons';

	let {
		view,
		onTogglePlayPause,
		onGoToVideo
	}: { view: NowPlayingView; onTogglePlayPause: () => void; onGoToVideo: () => void } = $props();
</script>

{#if view.video}
	<section class="flex flex-col gap-3.5 rounded-card bg-card p-3.5" aria-label="Now playing">
		<div class="flex items-center gap-3">
			<img
				src={view.video.thumbnailUrl}
				alt=""
				class="h-16 w-28 flex-none rounded-md bg-track object-cover"
			/>
			<div class="flex min-w-0 flex-col">
				<h2 class="m-0 line-clamp-2 text-lg font-medium break-words">{view.video.title}</h2>
				<span class="truncate text-xs text-muted">{view.video.channel}</span>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={onTogglePlayPause}
				disabled={!view.canControl}
				aria-label={view.playing ? 'Pause' : 'Play'}
				class="grid size-13 flex-none cursor-pointer place-items-center rounded-full border-0 bg-accent text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45"
			>
				<Icon path={view.playing ? PAUSE : PLAY} size={28} />
			</button>
			<button
				type="button"
				onclick={onGoToVideo}
				disabled={!view.canControl}
				class="cursor-pointer rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45"
			>
				Go to video
			</button>
		</div>
	</section>
{:else if view.ready}
	<section
		class="flex flex-col items-center gap-1 rounded-card bg-card px-3 py-7 text-center"
		aria-label="Now playing"
	>
		<b class="text-md font-medium">Nothing playing</b>
		<p class="m-0 text-xs text-muted">Open any YouTube video.</p>
	</section>
{/if}
