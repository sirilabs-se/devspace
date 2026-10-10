<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FullAutoFill } from 'svelte/elements';
	import Icon from './Icon.svelte';

	let {
		label,
		name,
		type = 'text',
		value = $bindable(''),
		placeholder,
		autocomplete,
		required = false,
		disabled = false,
		numeric = false,
		optional = false,
		hint,
		status,
		statusVariant = 'neutral',
		error,
		below
	}: {
		label: string;
		name: string;
		/** A password field gets a button to show or hide what was typed. */
		type?: 'text' | 'email' | 'password' | 'date';
		value?: string;
		placeholder?: string;
		autocomplete?: FullAutoFill;
		required?: boolean;
		/** Shown but not editable, and not sent with the form. */
		disabled?: boolean;
		/** For codes made of digits: phones show the number pad. */
		numeric?: boolean;
		/** Marks the field "Optional" beside its label. */
		optional?: boolean;
		/** Standing guidance shown under the field. */
		hint?: string;
		/** A short live message, e.g. the result of a check. Replaces the hint. */
		status?: string;
		statusVariant?: 'neutral' | 'success' | 'danger';
		error?: string;
		/** Extra content under the input, e.g. a strength meter. */
		below?: Snippet;
	} = $props();

	const id = $props.id();

	let revealed = $state(false);

	const confirmed = $derived(!error && !!status && statusVariant === 'success');
	const flagged = $derived(!!error || (!!status && statusVariant === 'danger'));
	const message = $derived(error ?? status ?? hint);
</script>

<div class="field">
	<label class="label" for={id}>
		<span>{label}</span>
		{#if optional}<span class="optional">Optional</span>{/if}
	</label>
	<div class="control" class:error={!!error} class:confirmed class:disabled>
		<input
			class="input"
			{id}
			{name}
			type={type === 'password' && revealed ? 'text' : type}
			{placeholder}
			{autocomplete}
			{disabled}
			inputmode={numeric ? 'numeric' : undefined}
			aria-required={required ? 'true' : undefined}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={message ? `${id}-message` : undefined}
		/>
		{#if type === 'password'}
			<button
				class="reveal"
				type="button"
				aria-label={revealed ? 'Hide password' : 'Show password'}
				aria-pressed={revealed}
				onclick={() => (revealed = !revealed)}
			>
				<Icon name={revealed ? 'eye-off' : 'eye'} size={18} />
			</button>
		{/if}
		{#if confirmed}<Icon name="check" size={18} />{/if}
		{#if error}<Icon name="alert" size={18} />{/if}
	</div>
	{#if below}
		{@render below()}
	{/if}
	{#if message}
		<p
			class="message"
			class:flagged
			id="{id}-message"
			role={error ? 'alert' : status ? 'status' : undefined}
		>
			{#if flagged}<Icon name="alert" size={14} />{/if}
			<span>{message}</span>
		</p>
	{/if}
</div>

<style>
	.label {
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--space-6);
		font-size: var(--font-size-14);
		font-weight: var(--font-weight-semibold);
	}

	.optional {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-medium);
	}

	.control {
		display: flex;
		align-items: center;
		gap: var(--space-10);
		height: var(--height-input);
		padding: 0 var(--space-14);
		background: var(--color-surface);
		border: var(--border-medium) solid var(--color-line-strong);
		border-radius: var(--radius-14);
		color: var(--color-ink-muted);
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

	.control.confirmed {
		border-color: var(--color-ink);
	}

	.control.disabled {
		background: var(--color-sunken);
		border-style: dashed;
	}

	.control.disabled .input {
		color: var(--color-ink-faint);
	}

	.control.error {
		background: var(--color-surface-error);
		border: var(--border-thick) solid var(--color-danger);
	}

	.input {
		flex: 1;
		min-width: 0;
		height: 100%;
		background: none;
		border: 0;
		outline: 0;
		color: var(--color-ink);
		font: inherit;
	}

	.input::placeholder {
		color: var(--color-ink-faint);
	}

	.reveal {
		display: grid;
		place-items: center;
		min-width: var(--size-icon-button);
		min-height: var(--size-icon-button);
		padding: var(--space-6);
		background: none;
		border: 0;
		border-radius: var(--radius-8);
		color: var(--color-ink-muted);
	}

	.message {
		display: flex;
		align-items: flex-start;
		gap: var(--space-6);
		margin-top: var(--space-6);
		color: var(--color-ink-muted);
		font-size: var(--font-size-13);
	}

	.message :global(.icon) {
		margin-top: var(--space-2);
	}

	.message.flagged {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}
</style>
