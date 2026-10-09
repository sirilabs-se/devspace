<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Button,
		Card,
		Heading,
		PageHeader,
		SelectField,
		Stack,
		Text,
		TextField
	} from '$lib/ui';

	let { data, form } = $props();

	const localeNames: Record<string, string> = {
		en: 'English',
		sv: 'Svenska (not available yet)'
	};
	const errorMessages: Record<string, string> = {
		name_required: 'Enter your full name.',
		name_too_long: 'Use at most 100 characters.',
		locale_invalid: 'Choose a language from the list.',
		time_zone_invalid: 'Choose a time zone from the list.'
	};
	const message = (code: string | undefined) => (code ? errorMessages[code] : undefined);

	// svelte-ignore state_referenced_locally
	let name = $state(data.profile.name);
	// svelte-ignore state_referenced_locally
	let locale = $state(data.profile.locale);
	// svelte-ignore state_referenced_locally
	let timeZone = $state(data.profile.timeZone);
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Profile · SaaS</title>
</svelte:head>

<PageHeader title="Profile" text="How you appear to organizers and other attendees." />

<Card>
	<form
		method="POST"
		action="?/save"
		novalidate
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
			};
		}}
	>
		<Stack gap="large">
			{#if form?.saved}
				<Alert variant="success" title="Profile saved" />
			{/if}

			<TextField
				label="Full name"
				name="name"
				autocomplete="name"
				required
				bind:value={name}
				error={message(form?.errors?.name)}
			/>

			<Stack gap="small">
				<Heading level={2}>Preferences</Heading>
				<Text variant="lead">Used for the app’s language and for showing dates and times.</Text>
			</Stack>

			<Stack gap="fields">
				<SelectField
					label="Language"
					name="locale"
					bind:value={locale}
					options={data.locales.map((code) => ({ value: code, label: localeNames[code] ?? code }))}
					hint="Only English is available for now. Your choice is remembered."
					error={message(form?.errors?.locale)}
				/>

				<SelectField
					label="Time zone"
					name="timeZone"
					bind:value={timeZone}
					options={data.timeZones.map((zone) => ({
						value: zone,
						label: zone.replaceAll('_', ' ')
					}))}
					error={message(form?.errors?.timeZone)}
				/>
			</Stack>

			<div>
				<Button type="submit" loading={submitting}>Save changes</Button>
			</div>
		</Stack>
	</form>
</Card>
