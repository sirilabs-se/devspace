<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Button,
		Card,
		Heading,
		ListRow,
		PageHeader,
		Stack,
		Text,
		TextField
	} from '$lib/ui';

	let { data, form } = $props();

	let reason = $state('');
	const adminErrors: Record<string, string> = {
		reason_required: 'Give a reason of up to 500 characters. The person is shown it.',
		is_self: 'You can’t suspend your own account.',
		is_admin: 'An admin’s account can’t be suspended.',
		already_suspended: 'This account is already suspended.',
		not_suspended: 'This account is not suspended.',
		not_found: 'That account can’t be viewed. It may be suspended or no longer exist.',
		already_impersonating: 'You are already viewing the app as someone.'
	};

	const user = $derived(data.user);

	const formatTime = (iso: string) =>
		new Date(iso).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'UTC'
		});
	const signInMethods = $derived(
		[
			user.hasPassword ? 'password' : null,
			...user.providers,
			user.passkeyCount > 0
				? `${user.passkeyCount} ${user.passkeyCount === 1 ? 'passkey' : 'passkeys'}`
				: null
		]
			.filter(Boolean)
			.join(', ')
	);
	// The same words the person sees for their own activity would need the same list;
	// here the recorded name is shown, which is what an admin searches the audit log by.
	const readable = (action: string) => action.replaceAll('_', ' ');
</script>

<svelte:head>
	<title>{user.name} · Admin · SaaS</title>
</svelte:head>

<PageHeader title={user.name} text={user.email} />

<Stack gap="large">
	<div><Button href="/admin/users" variant="ghost" size="small">Back to users</Button></div>

	{#if user.suspended}
		<Alert variant="danger" title="This account is suspended">
			{user.suspensionReason ?? 'No reason was recorded.'}
		</Alert>
	{/if}
	{#if user.deletionRequestedAt}
		<Alert variant="warning" title="Deletion requested">
			This person asked to delete their account on {formatTime(user.deletionRequestedAt)} (UTC).
		</Alert>
	{/if}

	<Card>
		<Stack gap="large">
			<Heading level={2}>Account</Heading>
			<div>
				<ListRow title="Role" text={user.role === 'admin' ? 'Admin' : 'User'} />
				<ListRow title="Username" text={user.username ? `@${user.username}` : 'None'} />
				<ListRow title="Email verified" text={user.emailVerified ? 'Yes' : 'No'} />
				<ListRow title="Joined" text="{formatTime(user.createdAt)} (UTC)" />
				<ListRow title="Ways to sign in" text={signInMethods || 'None'} />
				<ListRow title="Two-step verification" text={user.twoStepOn ? 'On' : 'Off'} />
			</div>
		</Stack>
	</Card>

	{#if user.role !== 'admin' && !user.suspended}
		<Card>
			<Stack gap="large">
				<Stack gap="small">
					<Heading level={2}>View the app as this person</Heading>
					<Text variant="lead">
						Opens the app as they see it, for up to an hour. They are told by email, and it is
						recorded. You won’t be able to change their password, email or ways of signing in, or
						delete their account.
					</Text>
				</Stack>
				<form method="POST" action="?/impersonate">
					<Button type="submit" variant="outline">View as {user.name}</Button>
				</form>
			</Stack>
		</Card>
	{/if}

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>{user.suspended ? 'Reinstate' : 'Suspend'}</Heading>
				<Text variant="lead">
					{user.suspended
						? 'Lifts the suspension, so this person can sign in again. They are told by email.'
						: 'Signs this person out everywhere and stops them signing in. They are told by email, with the reason.'}
				</Text>
			</Stack>

			{#if form?.suspended}
				<Alert variant="success" title="Account suspended" />
			{:else if form?.reinstated}
				<Alert variant="success" title="Account reinstated" />
			{:else if form?.adminError}
				<Alert variant="danger" title="That didn’t work">{adminErrors[form.adminError]}</Alert>
			{/if}

			{#if user.suspended}
				<form method="POST" action="?/reinstate" use:enhance>
					<Button type="submit">Reinstate this account</Button>
				</form>
			{:else}
				<form
					method="POST"
					action="?/suspend"
					novalidate
					use:enhance={() => {
						return async ({ result, update }) => {
							await update({ reset: false });
							if (result.type === 'success') reason = '';
						};
					}}
				>
					<Stack gap="medium">
						<TextField
							label="Reason"
							name="reason"
							hint="Shown to the person in the email they receive."
							required
							bind:value={reason}
						/>
						<div><Button type="submit" variant="danger">Suspend this account</Button></div>
					</Stack>
				</form>
			{/if}
		</Stack>
	</Card>

	<Card>
		<Stack gap="large">
			<Stack gap="small">
				<Heading level={2}>Recent security events</Heading>
				<Text variant="lead">The latest 20, newest first. Times are in UTC.</Text>
			</Stack>
			{#if user.recentActivity.length === 0}
				<Text variant="muted">Nothing has happened yet.</Text>
			{:else}
				<div>
					{#each user.recentActivity as event, index (index)}
						<ListRow
							title={readable(event.action)}
							text="{formatTime(event.at)} · {event.device}{event.ipAddress
								? ` · ${event.ipAddress}`
								: ''}"
						/>
					{/each}
				</div>
			{/if}
		</Stack>
	</Card>
</Stack>
