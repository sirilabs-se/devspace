<script lang="ts">
	import { encode } from 'uqr';

	let {
		value,
		label
	}: {
		/** The text the code holds. */
		value: string;
		/** Read out to people who can't see the code. */
		label: string;
	} = $props();

	const code = $derived(encode(value, { border: 2 }));
	const cells = $derived(
		code.data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [{ x, y }] : [])))
	);
</script>

<svg
	class="qr"
	viewBox="0 0 {code.size} {code.size}"
	role="img"
	aria-label={label}
	shape-rendering="crispEdges"
>
	<rect class="background" width={code.size} height={code.size} />
	{#each cells as cell (`${cell.x}-${cell.y}`)}
		<rect class="cell" x={cell.x} y={cell.y} width="1" height="1" />
	{/each}
</svg>

<style>
	.qr {
		display: block;
		width: var(--size-qr-code);
		max-width: 100%;
		height: auto;
		border: var(--border-thin) solid var(--color-line);
		border-radius: var(--radius-12);
	}

	/* A QR code must stay dark on light to be scannable, whatever the theme. */
	.background {
		fill: var(--color-surface);
	}

	.cell {
		fill: var(--color-ink);
	}
</style>
