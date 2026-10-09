<script lang="ts">
	import { page } from '$app/state';
	import { SettingsLayout } from '$lib/ui';

	let { children } = $props();
</script>

<SettingsLayout
	heading="Account"
	current={page.url.pathname}
	items={[
		{ label: 'Profile', href: '/settings/profile' },
		{ label: 'Account settings', href: '/settings/account' },
		{ label: 'Security', href: '/settings/security' }
	]}
>
	{@render children()}
</SettingsLayout>
