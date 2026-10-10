<script lang="ts">
	import { page } from '$app/state';
	import { SettingsLayout } from '$lib/ui';

	let { children } = $props();

	const current = $derived(
		page.url.pathname.startsWith('/admin/users') ? '/admin/users' : page.url.pathname
	);
</script>

<SettingsLayout heading="Admin" {current} items={[{ label: 'Users', href: '/admin/users' }]}>
	{@render children()}
</SettingsLayout>
