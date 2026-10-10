<script lang="ts">
	let { path, size = 20 }: { path: string; size?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
	<path d={path} fill-rule="evenodd" />
</svg>
