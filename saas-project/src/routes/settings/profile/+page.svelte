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

	const usernameRule =
		'Use 3 to 30 letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.';
	const usernameMessages: Record<string, string> = {
		available: 'Available',
		invalid: usernameRule,
		reserved: 'That username isn’t available.',
		taken: 'That username is already taken.'
	};

	// svelte-ignore state_referenced_locally
	let username = $state(data.profile.username ?? '');
	let savingUsername = $state(false);
	let usernameStatus = $state<'available' | 'invalid' | 'reserved' | 'taken' | undefined>();
	let checkedUsername = $state('');

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			timeZone: data.profile.timeZone
		});

	// A username that already exists can be changed once every 30 days.
	const lockedUntil = $derived(form?.allowedAt ?? data.usernameChangeAllowedAt);
	const usernameLocked = $derived(!!lockedUntil && !!data.profile.username);

	// Asks the server whether the username is free, shortly after typing stops.
	$effect(() => {
		const candidate = username.trim();
		if (candidate === '' || candidate === (data.profile.username ?? '')) {
			usernameStatus = undefined;
			return;
		}

		const timer = setTimeout(async () => {
			const response = await fetch(
				`/api/username-available?username=${encodeURIComponent(candidate)}`
			);
			if (!response.ok || candidate !== username.trim()) return;
			const result: { available: boolean; reason?: 'invalid' | 'reserved' | 'taken' } =
				await response.json();
			usernameStatus = result.available ? 'available' : result.reason;
			checkedUsername = candidate;
		}, 300);

		return () => clearTimeout(timer);
	});

	const showUsernameStatus = $derived(
		usernameStatus !== undefined && checkedUsername === username.trim()
	);
	const usernameError = $derived(
		form?.usernameError && form.usernameError !== 'too_soon'
			? usernameMessages[form.usernameError]
			: undefined
	);
</script>

<svelte:head>
	<title>Profile · SaaS</title>
</svelte:head>

<PageHeader title="Profile" text="How you appear to organizers and other attendees." />

<Stack gap="large">
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
						options={data.locales.map((code) => ({
							value: code,
							label: localeNames[code] ?? code
						}))}
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

	<Card>
		<form
			method="POST"
			action="?/username"
			novalidate
			use:enhance={() => {
				savingUsername = true;
				return async ({ update }) => {
					await update({ reset: false });
					savingUsername = false;
				};
			}}
		>
			<Stack gap="large">
				<Stack gap="small">
					<Heading level={2}>Username</Heading>
					<Text variant="lead">
						Your public handle. It can be changed once every 30 days, and your old name is kept for
						you for 30 days.
					</Text>
				</Stack>

				{#if form?.usernameSaved}
					<Alert variant="success" title="Username saved" />
				{/if}
				{#if usernameLocked && lockedUntil}
					<Alert variant="info" title="You changed your username recently">
						You can change it again on {formatDate(lockedUntil)}.
					</Alert>
				{/if}

				<TextField
					label="Username"
					name="username"
					placeholder="maya.okafor"
					autocomplete="username"
					optional
					disabled={usernameLocked}
					hint="Shown on your public profile."
					bind:value={username}
					status={showUsernameStatus && usernameStatus
						? usernameMessages[usernameStatus]
						: undefined}
					statusVariant={usernameStatus === 'available' ? 'success' : 'danger'}
					error={showUsernameStatus ? undefined : usernameError}
				/>

				<div>
					<Button type="submit" loading={savingUsername} disabled={usernameLocked}>
						Save username
					</Button>
				</div>
			</Stack>
		</form>
	</Card>
</Stack>
