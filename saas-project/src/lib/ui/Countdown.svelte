<script lang="ts">
	let {
		seconds,
		onfinish
	}: {
		/** How long to count down from. Restarts whenever this changes. */
		seconds: number;
		/** Called once when the countdown reaches zero. */
		onfinish?: () => void;
	} = $props();

	let left = $derived(Math.max(0, Math.ceil(seconds)));

	$effect(() => {
		if (left <= 0) return;
		const timer = setTimeout(() => {
			left -= 1;
			if (left === 0) onfinish?.();
		}, 1000);
		return () => clearTimeout(timer);
	});

	const text = $derived(
		`${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
	);
</script>

<b class="countdown" aria-live="off">{text}</b>

<style>
	.countdown {
		font-family: var(--font-family-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
