import { exportAuditEvents, requireRole } from '$lib/server/modules/identity';
import { auditFiltersFrom } from '../filters';
import type { RequestHandler } from './$types';

// Downloads the filtered audit log as a CSV file.
export const GET: RequestHandler = async ({ locals, url, request, getClientAddress }) => {
	const admin = requireRole(locals.user, 'admin');

	const { csv } = await exportAuditEvents(admin, auditFiltersFrom(url), {
		ipAddress: getClientAddress(),
		userAgent: request.headers.get('user-agent')
	});

	const today = new Date().toISOString().slice(0, 10);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="audit-log-${today}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
