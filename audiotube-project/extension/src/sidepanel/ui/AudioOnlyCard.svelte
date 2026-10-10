<script lang="ts">
	import Icon from './Icon.svelte';
	import { HEADPHONES, VIDEO } from './icons';
	import Switch from './Switch.svelte';

	let {
		checked,
		lowestQuality,
		onToggle
	}: { checked: boolean; lowestQuality: boolean; onToggle: () => void } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label="Audio only"
	aria-describedby="audio-only-status"
	onclick={onToggle}
	class="flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-card border-0 bg-card px-4 py-3.5 text-left text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
>
	<span class="flex min-w-0 items-center gap-3">
		<span
			class="grid size-11 flex-none place-items-center rounded-full {checked
				? 'bg-accent/18 text-accent'
				: 'bg-track text-muted'}"
		>
			<Icon path={checked ? HEADPHONES : VIDEO} size={22} />
		</span>
		<span class="flex min-w-0 flex-col">
			<span class="text-md font-medium">Audio only</span>
			<span id="audio-only-status" class="text-xs text-muted">
				{checked
					? lowestQuality
						? 'Video hidden · lowest quality requested'
						: 'Video hidden'
					: 'Video visible on the YouTube tab'}
			</span>
		</span>
	</span>
	<Switch {checked} />
</button>
