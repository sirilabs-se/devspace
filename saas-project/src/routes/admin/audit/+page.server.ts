import { listAuditEvents, requireRole } from '$lib/server/modules/identity';
import { auditFiltersFrom } from './filters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const admin = requireRole(locals.user, 'admin');
	const filters = auditFiltersFrom(url);

	const result = await listAuditEvents(admin, filters, url.searchParams.get('page') ?? 1);

	return {
		filters,
		page: result.page,
		pageCount: result.pageCount,
		total: result.total,
		actions: result.actions,
		entries: result.entries.map((entry) => ({ ...entry, at: entry.at.toISOString() }))
	};
};
