<script lang="ts">
	import type { VolumeView } from '../core';
	import VolumeIcon from './VolumeIcon.svelte';

	let {
		view,
		onSetLevel,
		onToggleMute
	}: {
		view: VolumeView;
		onSetLevel: (level: number) => void;
		onToggleMute: () => void;
	} = $props();

	const shownLevel = $derived(view.muted ? 0 : view.level);
</script>

<div class="flex items-center gap-2">
	<button
		type="button"
		onclick={onToggleMute}
		aria-pressed={view.muted}
		aria-label={view.muted ? 'Unmute' : 'Mute'}
		class="grid size-9 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
	>
		<VolumeIcon level={view.level} muted={view.muted} />
	</button>
	<input
		type="range"
		class="seek"
		aria-label="Volume"
		min={0}
		max={100}
		step={1}
		value={shownLevel}
		aria-valuetext={view.muted ? 'Muted' : `${view.level} percent`}
		style:--p="{shownLevel}%"
		oninput={(event) => onSetLevel(Number(event.currentTarget.value))}
	/>
	<!-- The slider announces its value itself, so this is for the eyes only. -->
	<span
		data-testid="volume-text"
		aria-hidden="true"
		class="w-11 flex-none text-right text-xs text-muted tabular-nums"
	>
		{view.muted ? 'Muted' : `${view.level}%`}
	</span>
</div>
