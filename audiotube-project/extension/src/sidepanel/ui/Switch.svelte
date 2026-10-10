<script lang="ts">
	let { checked }: { checked: boolean } = $props();
</script>

<span
	aria-hidden="true"
	class="relative inline-block h-5.5 w-10 flex-none rounded-full transition motion-reduce:transition-none {checked
		? 'bg-accent'
		: 'bg-track ring-1 ring-muted ring-inset'}"
>
	<span
		class="absolute top-0.75 left-0.75 size-4 rounded-full transition motion-reduce:transition-none {checked
			? 'translate-x-4.5 bg-on-accent'
			: 'bg-muted'}"
	></span>
</span>
