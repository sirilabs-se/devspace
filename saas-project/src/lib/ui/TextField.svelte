<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FullAutoFill } from 'svelte/elements';

	let {
		label,
		name,
		type = 'text',
		value = $bindable(''),
		autocomplete,
		required = false,
		hint,
		status,
		statusVariant = 'neutral',
		error,
		below
	}: {
		label: string;
		name: string;
		type?: 'text' | 'email' | 'password';
		value?: string;
		autocomplete?: FullAutoFill;
		required?: boolean;
		/** Standing guidance shown under the label. */
		hint?: string;
		/** A short live message, e.g. the result of a check. */
		status?: string;
		statusVariant?: 'neutral' | 'success' | 'danger';
		error?: string;
		/** Extra content under the input, e.g. a strength meter. */
		below?: Snippet;
	} = $props();

	const id = $props.id();
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	{#if hint}
		<span class="hint" id="{id}-hint">{hint}</span>
	{/if}
	<input
		class="input"
		class:invalid={!!error}
		{id}
		{name}
		{type}
		{autocomplete}
		{required}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby="{hint ? `${id}-hint ` : ''}{error ? `${id}-error` : ''}"
	/>
	{#if below}
		{@render below()}
	{/if}
	{#if status && !error}
		<span class="status {statusVariant}" role="status">{status}</span>
	{/if}
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

	.label {
		font-weight: var(--font-weight-bold);
	}

	.hint,
	.status {
		color: var(--color-text-muted);
		font-size: var(--font-size-small);
	}

	.status.success {
		color: var(--color-success);
	}

	.status.danger,
	.error {
		color: var(--color-danger);
		font-size: var(--font-size-small);
	}

	.input {
		padding: var(--space-2);
		background: var(--color-surface);
		color: var(--color-text);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius-small);
		font-family: inherit;
		font-size: var(--font-size-body);
	}

	.input:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-accent);
	}

	.input.invalid {
		border-color: var(--color-danger);
	}
</style>
