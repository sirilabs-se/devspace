<script lang="ts">
	let {
		label,
		name,
		accept,
		hint,
		error
	}: {
		label: string;
		name: string;
		/** The kinds of file offered in the picker, e.g. "image/png,image/jpeg". */
		accept?: string;
		hint?: string;
		error?: string;
	} = $props();

	const id = $props.id();
	const message = $derived(error ?? hint);
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	<input
		class="input"
		type="file"
		{id}
		{name}
		{accept}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={message ? `${id}-message` : undefined}
	/>
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

	.input {
		width: 100%;
		padding: var(--space-10) var(--space-14);
		background: var(--color-surface);
		border: var(--border-medium) dashed var(--color-line-strong);
		border-radius: var(--radius-14);
		font: inherit;
		font-size: var(--font-size-14);
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
