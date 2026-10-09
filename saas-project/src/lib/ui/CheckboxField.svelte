<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		checked = $bindable(false),
		required = false,
		error,
		children
	}: {
		name: string;
		checked?: boolean;
		required?: boolean;
		error?: string;
		/** The label text. */
		children: Snippet;
	} = $props();

	const id = $props.id();
</script>

<div class="field">
	<label class="row" for={id}>
		<input
			class="box"
			type="checkbox"
			{id}
			{name}
			{required}
			bind:checked
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
		/>
		<span>{@render children()}</span>
	</label>
	{#if error}
		<span class="error" id="{id}-error">{error}</span>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.box {
		flex: none;
		width: var(--control-size);
		height: var(--control-size);
		margin: var(--space-1) 0 0;
		accent-color: var(--color-accent);
	}

	.error {
		color: var(--color-danger);
		font-size: var(--font-size-small);
	}
</style>
