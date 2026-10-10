import { and, count, desc, eq, gte, ilike, inArray, lt, or, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recordAuditEvent } from './audit';
import { describeDevice } from './device';
import type { RequestContext } from './request-context';
import { auditEvents, users, type AuditDetails } from './schema';
import { requireRole, type SessionUser } from './session';

// The admin's view of the audit log: read and export only. Entries can't be
// edited or deleted from here, or from anywhere else in the app.

export const AUDIT_PAGE_SIZE = 25;
/** An export holds at most this many entries, newest first. */
export const AUDIT_EXPORT_LIMIT = 10_000;

export type AuditFilters = {
	/** Part of the email, name or username of the person who acted or was acted on. */
	user?: string;
	/** An exact action name, e.g. "login_failed". */
	action?: string;
	/** First day to include, as YYYY-MM-DD (UTC). */
	from?: string;
	/** Last day to include, as YYYY-MM-DD (UTC). */
	to?: string;
};

export type AuditPerson = { id: string; name: string; email: string };

export type AuditEntry = {
	id: number;
	at: Date;
	action: string;
	/** Who did it. Null when nobody was signed in, or the account has since been deleted. */
	actor: AuditPerson | null;
	/** Whose account it concerns. */
	subject: AuditPerson | null;
	ipAddress: string | null;
	device: string;
	details: AuditDetails | null;
};

const day = (value: string | undefined): Date | null => {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
};
const literal = (text: string) => text.replace(/[\\%_]/g, (character) => `\\${character}`);

/** Turns the filters into a database condition. `null` means nothing can match. */
async function conditionFor(filters: AuditFilters): Promise<SQL | undefined | null> {
	const conditions: SQL[] = [];

	const userText = filters.user?.trim().slice(0, 200);
	if (userText) {
		const pattern = `%${literal(userText)}%`;
		const matching = await db
			.select({ id: users.id })
			.from(users)
			.where(
				or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.username, pattern))
			)
			.limit(500);
		if (matching.length === 0) return null;
		const ids = matching.map((user) => user.id);
		conditions.push(
			or(inArray(auditEvents.actorUserId, ids), inArray(auditEvents.subjectUserId, ids))!
		);
	}

	const action = filters.action?.trim();
	if (action) conditions.push(eq(auditEvents.action, action));

	const from = day(filters.from);
	if (from) conditions.push(gte(auditEvents.createdAt, from));
	const to = day(filters.to);
	// The whole of the last day is included.
	if (to) conditions.push(lt(auditEvents.createdAt, new Date(to.getTime() + 24 * 60 * 60 * 1000)));

	return conditions.length > 0 ? and(...conditions) : undefined;
}

async function entries(
	condition: SQL | undefined,
	limit: number,
	offset: number
): Promise<AuditEntry[]> {
	const rows = await db
		.select()
		.from(auditEvents)
		.where(condition)
		.orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
		.limit(limit)
		.offset(offset);

	const ids = [...new Set(rows.flatMap((row) => [row.actorUserId, row.subjectUserId]))].filter(
		(id): id is string => id !== null
	);
	const people =
		ids.length === 0
			? []
			: await db
					.select({ id: users.id, name: users.name, email: users.email })
					.from(users)
					.where(inArray(users.id, ids));
	const person = (id: string | null) => people.find((candidate) => candidate.id === id) ?? null;

	return rows.map((row) => ({
		id: row.id,
		at: row.createdAt,
		action: row.action,
		actor: person(row.actorUserId),
		subject: person(row.subjectUserId),
		ipAddress: row.ipAddress,
		device: describeDevice(row.userAgent),
		details: row.details
	}));
}

export type AuditListResult = {
	entries: AuditEntry[];
	page: number;
	pageCount: number;
	total: number;
	/** Every kind of action in the log, for the filter's list. */
	actions: string[];
};

/** A page of the audit log, newest first, 25 to a page. Admins only. */
export async function listAuditEvents(
	admin: SessionUser,
	filters: AuditFilters,
	page: unknown = 1
): Promise<AuditListResult> {
	requireRole(admin, 'admin');

	const kinds = await db
		.selectDistinct({ action: auditEvents.action })
		.from(auditEvents)
		.orderBy(auditEvents.action);
	const actions = kinds.map((kind) => kind.action);

	const condition = await conditionFor(filters);
	if (condition === null) return { entries: [], page: 1, pageCount: 1, total: 0, actions };

	const [{ total }] = await db.select({ total: count() }).from(auditEvents).where(condition);
	const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
	const wanted = Math.floor(Number(page));
	const current = Number.isFinite(wanted) ? Math.min(Math.max(1, wanted), pageCount) : 1;

	return {
		entries: await entries(condition, AUDIT_PAGE_SIZE, (current - 1) * AUDIT_PAGE_SIZE),
		page: current,
		pageCount,
		total,
		actions
	};
}

/** A spreadsheet cell: quoted, and never able to start a formula. */
function cell(value: string | number | null): string {
	const text = value === null ? '' : String(value);
	const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
	return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * The filtered audit log as a CSV file, newest first, up to 10,000 entries.
 * Exporting is itself recorded in the log. Admins only.
 */
export async function exportAuditEvents(
	admin: SessionUser,
	filters: AuditFilters,
	context: RequestContext
): Promise<{ csv: string; count: number }> {
	requireRole(admin, 'admin');

	const condition = await conditionFor(filters);
	const rows = condition === null ? [] : await entries(condition, AUDIT_EXPORT_LIMIT, 0);

	const header = [
		'Time (UTC)',
		'Action',
		'By',
		'By email',
		'About',
		'About email',
		'Network address',
		'Device',
		'Details'
	];
	const lines = rows.map((row) =>
		[
			row.at.toISOString(),
			row.action,
			row.actor?.name ?? null,
			row.actor?.email ?? null,
			row.subject?.name ?? null,
			row.subject?.email ?? null,
			row.ipAddress,
			row.device,
			row.details ? JSON.stringify(row.details) : null
		]
			.map(cell)
			.join(',')
	);

	await recordAuditEvent(admin.id, 'audit_log_exported', null, {
		...context,
		details: { entries: rows.length }
	});
	return { csv: [header.map(cell).join(','), ...lines].join('\r\n') + '\r\n', count: rows.length };
}
