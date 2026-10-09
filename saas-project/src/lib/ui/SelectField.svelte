<script lang="ts">
	let {
		label,
		name,
		value = $bindable(''),
		options,
		hint,
		error
	}: {
		label: string;
		name: string;
		value?: string;
		options: { value: string; label: string }[];
		hint?: string;
		error?: string;
	} = $props();

	const id = $props.id();
	const message = $derived(error ?? hint);
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	<div class="control" class:error={!!error}>
		<select
			class="select"
			{id}
			{name}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={message ? `${id}-message` : undefined}
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	{#if message}
		<p class="message" class:flagged={!!error} id="{id}-message" role={error ? 'alert' : undefined}>
			{message}
		</p>
	{/if}
</div>

<style>
	.label {
		display: block;
		margin-bottom: var(--space-6);
		font-size: var(--font-size-14);
		font-weight: var(--font-weight-semibold);
	}

	.control {
		display: flex;
		align-items: center;
		height: var(--height-input);
		padding: 0 var(--space-14);
		background: var(--color-surface);
		border: var(--border-medium) solid var(--color-line-strong);
		border-radius: var(--radius-14);
		transition:
			border-color var(--duration-normal),
			box-shadow var(--duration-normal);
	}

	.control:hover {
		border-color: var(--color-ink-muted);
	}

	.control:focus-within {
		border-color: var(--color-ink);
		outline: var(--border-thick) solid var(--color-ink);
		outline-offset: var(--space-1);
		box-shadow: var(--shadow-input-focus);
	}

	.control.error {
		background: var(--color-surface-error);
		border: var(--border-thick) solid var(--color-danger);
	}

	.select {
		flex: 1;
		min-width: 0;
		height: 100%;
		background: none;
		border: 0;
		outline: 0;
		color: var(--color-ink);
		font: inherit;
	}

	.message {
		margin-top: var(--space-6);
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
	}

	.message.flagged {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}
</style>
