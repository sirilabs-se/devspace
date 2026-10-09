<script lang="ts">
	let {
		name,
		image,
		size = 'medium'
	}: {
		/** The person's name; its initials are shown when there is no picture. */
		name: string;
		image?: string | null;
		size?: 'small' | 'medium' | 'large';
	} = $props();

	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);
</script>

{#if image}
	<img class="avatar {size}" src={image} alt="" />
{:else}
	<span class="avatar initials {size}" aria-hidden="true">{initials}</span>
{/if}

<style>
	.avatar {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-avatar-medium);
		height: var(--size-avatar-medium);
		object-fit: cover;
		border-radius: var(--radius-round);
	}

	.small {
		width: var(--size-avatar-small);
		height: var(--size-avatar-small);
		font-size: var(--font-size-13);
	}

	.large {
		width: var(--size-avatar-large);
		height: var(--size-avatar-large);
		font-size: var(--font-size-heading-2);
	}

	.initials {
		background: var(--color-ink);
		color: var(--color-surface);
		font-weight: var(--font-weight-bold);
	}
</style>
