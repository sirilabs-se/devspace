<script lang="ts">
	import type { NowPlayingView } from '../core';
	import Icon from './Icon.svelte';
	import { PAUSE, PLAY } from './icons';

	let {
		view,
		onTogglePlayPause,
		onGoToVideo,
		onResume
	}: {
		view: NowPlayingView;
		onTogglePlayPause: () => void;
		onGoToVideo: () => void;
		onResume: () => void;
	} = $props();
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
				{#if view.canResume}
					<span class="text-xs text-muted">Paused at {view.video.positionText}</span>
				{/if}
			</div>
		</div>
		{#if view.progress}
			<div class="flex flex-col gap-1.5">
				{#if view.progress.live}
					<div class="flex items-center justify-between text-xs">
						<span class="font-medium text-accent">Live</span>
						{#if view.progress.buffering}<span class="text-muted">Buffering</span>{/if}
					</div>
				{:else}
					<div
						role="progressbar"
						aria-label="Progress"
						aria-valuemin={0}
						aria-valuemax={view.progress.durationSec ?? 0}
						aria-valuenow={view.progress.elapsedSec}
						aria-valuetext={view.progress.remainingText === null
							? view.progress.elapsedText
							: `${view.progress.elapsedText}, ${view.progress.remainingText} left`}
						class="h-1 w-full overflow-hidden rounded-full bg-track"
					>
						<div
							class="h-full bg-accent"
							style:width="{(view.progress.fraction ?? 0) * 100}%"
						></div>
					</div>
					<div class="flex items-center justify-between text-xs text-muted">
						<span>{view.progress.elapsedText}</span>
						{#if view.progress.buffering}<span>Buffering</span>{/if}
						<span
							>{view.progress.remainingText === null ? '' : '-' + view.progress.remainingText}</span
						>
					</div>
				{/if}
			</div>
		{/if}
		<div class="flex items-center gap-3">
			{#if view.canResume}
				<button
					type="button"
					onclick={onResume}
					class="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-5 py-3 text-md font-medium text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<Icon path={PLAY} size={20} />
					Resume
				</button>
			{:else}
				<button
					type="button"
					onclick={onTogglePlayPause}
					disabled={!view.canControl}
					aria-label={view.playing ? 'Pause' : 'Play'}
					class="grid size-13 flex-none cursor-pointer place-items-center rounded-full border-0 bg-accent text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45"
				>
					<Icon path={view.playing ? PAUSE : PLAY} size={28} />
				</button>
			{/if}
			<button
				type="button"
				onclick={onGoToVideo}
				disabled={!view.canControl}
				class="cursor-pointer rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45"
			>
				Go to video
			</button>
		</div>
		{#if view.waitingToStart}
			<p role="status" class="m-0 text-xs text-muted">
				Waiting to start. Show the tab to begin playback.
			</p>
		{/if}
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
