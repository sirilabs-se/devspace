<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

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
	<label class="row" class:error={!!error} for={id}>
		<input
			class="input"
			type="checkbox"
			{id}
			{name}
			aria-required={required ? 'true' : undefined}
			bind:checked
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
		/>
		<span class="box"><Icon name="check" size={14} /></span>
		<span>{@render children()}</span>
	</label>
	{#if error}
		<p class="message" id="{id}-error" role="alert">
			<Icon name="alert" size={14} />
			<span>{error}</span>
		</p>
	{/if}
</div>

<style>
	.row {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: var(--space-10);
		font-size: var(--font-size-14);
		cursor: pointer;
	}

	.input {
		position: absolute;
		opacity: 0%;
	}

	.box {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-checkbox);
		height: var(--size-checkbox);
		margin-top: var(--space-1);
		background: var(--color-surface);
		border: var(--border-medium) solid var(--color-ink-muted);
		border-radius: var(--radius-7);
		color: transparent;
	}

	.input:checked + .box {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-surface);
	}

	.input:focus-visible + .box {
		outline: var(--focus-ring-width) solid var(--color-ink);
		outline-offset: var(--focus-ring-offset);
	}

	.error .box {
		border: var(--border-heavy) dashed var(--color-ink);
	}

	.message {
		display: flex;
		align-items: flex-start;
		gap: var(--space-6);
		margin-top: var(--space-6);
		font-size: var(--font-size-13);
		font-weight: var(--font-weight-semibold);
	}

	.message :global(.icon) {
		margin-top: var(--space-2);
	}
</style>
