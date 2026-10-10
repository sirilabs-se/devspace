import type { AuditFilters } from '$lib/server/modules/identity';

/** Reads the audit log filters from a page address. */
export function auditFiltersFrom(url: URL): Required<AuditFilters> {
	const text = (name: string) => url.searchParams.get(name)?.trim() ?? '';
	return { user: text('user'), action: text('action'), from: text('from'), to: text('to') };
}
