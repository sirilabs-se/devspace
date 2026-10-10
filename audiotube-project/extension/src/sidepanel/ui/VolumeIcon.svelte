<script lang="ts">
	/** A speaker that shows more sound waves the louder it is, and a cross when muted. */
	let { level, muted, size = 20 }: { level: number; muted: boolean; size?: number } = $props();

	// 0: speaker only, then one, two and three waves.
	const waves = $derived(level <= 0 ? 0 : level < 34 ? 1 : level < 67 ? 2 : 3);
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	data-waves={muted ? 'muted' : waves}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
>
	<path d="M3 9v6h4l5 5V4L7 9z" fill="currentColor" stroke="none" />
	{#if muted}
		<path d="M16 9.5l5 5M21 9.5l-5 5" />
	{:else}
		{#if waves >= 1}<path d="M15 9.5a3.5 3.5 0 0 1 0 5" />{/if}
		{#if waves >= 2}<path d="M17.5 7a7 7 0 0 1 0 10" />{/if}
		{#if waves >= 3}<path d="M20 4.5a10.5 10.5 0 0 1 0 15" />{/if}
	{/if}
</svg>
