<script lang="ts" module>
	export type IconName =
		'alert' | 'check' | 'compass' | 'eye' | 'eye-off' | 'info' | 'mail' | 'ticket' | 'users' | 'x';
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'alert'}
		<path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" />
	{:else if name === 'check'}
		<path d="m5 12.5 4.5 4.5L19 7.5" />
	{:else if name === 'compass'}
		<circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
	{:else if name === 'eye'}
		<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
	{:else if name === 'eye-off'}
		<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle
			cx="12"
			cy="12"
			r="3"
		/><path d="M4 4l16 16" />
	{:else if name === 'info'}
		<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" />
	{:else if name === 'mail'}
		<rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3.5 7 8.5 6 8.5-6" />
	{:else if name === 'ticket'}
		<path
			d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5Z"
		/><path d="M14 6v12" />
	{:else if name === 'users'}
		<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path
			d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2"
		/>
	{:else if name === 'x'}
		<path d="M6 6l12 12M18 6 6 18" />
	{/if}
</svg>

<style>
	.icon {
		flex: none;
	}
</style>
