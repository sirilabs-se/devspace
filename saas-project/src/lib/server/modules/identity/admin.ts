import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { listSecurityActivity, type SecurityActivity } from './activity';
import { recordAuditEvent } from './audit';
import { listConnections } from './connections';
import type { RequestContext } from './request-context';
import { passkeys, users } from './schema';
import { requireRole, type Role, type SessionUser } from './session';
import { toUserId, type UserId } from './user-id';

// What the admin area can see and do. Every function checks the admin role
// itself, whatever the page that called it has already checked.

export const ADMIN_PAGE_SIZE = 25;

export type AdminUserSummary = {
	id: UserId;
	name: string;
	email: string;
	username: string | null;
	role: Role;
	emailVerified: boolean;
	suspended: boolean;
	createdAt: Date;
};

export type UserSearchResult = {
	users: AdminUserSummary[];
	page: number;
	pageCount: number;
	total: number;
};

const summaryColumns = {
	id: users.id,
	name: users.name,
	email: users.email,
	username: users.displayUsername,
	role: users.role,
	emailVerified: users.emailVerified,
	banned: users.banned,
	createdAt: users.createdAt
};

const toRole = (role: string): Role => (role === 'admin' ? 'admin' : 'user');

/** Treats % and _ as ordinary characters, so a search can't be turned into a wildcard. */
const literal = (text: string) => text.replace(/[\\%_]/g, (character) => `\\${character}`);

/**
 * Finds users whose email, name or username contains the text, newest first,
 * 25 to a page. An empty search lists everyone.
 */
export async function searchUsers(
	admin: SessionUser,
	query: unknown,
	page: unknown = 1
): Promise<UserSearchResult> {
	requireRole(admin, 'admin');

	const text = typeof query === 'string' ? query.trim().slice(0, 200) : '';
	const pattern = `%${literal(text)}%`;
	const matching =
		text === ''
			? undefined
			: or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.username, pattern));

	const [{ total }] = await db.select({ total: count() }).from(users).where(matching);
	const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
	const wanted = Math.floor(Number(page));
	const current = Number.isFinite(wanted) ? Math.min(Math.max(1, wanted), pageCount) : 1;

	const rows = await db
		.select(summaryColumns)
		.from(users)
		.where(matching)
		.orderBy(desc(users.createdAt), users.id)
		.limit(ADMIN_PAGE_SIZE)
		.offset((current - 1) * ADMIN_PAGE_SIZE);

	return {
		users: rows.map(({ banned, role, id, ...row }) => ({
			...row,
			id: toUserId(id),
			role: toRole(role),
			suspended: banned
		})),
		page: current,
		pageCount,
		total
	};
}

export type AdminUserDetails = AdminUserSummary & {
	suspensionReason: string | null;
	/** Set when the person has asked to delete their account. */
	deletionRequestedAt: Date | null;
	twoStepOn: boolean;
	hasPassword: boolean;
	providers: string[];
	passkeyCount: number;
	recentActivity: SecurityActivity[];
};

/**
 * One user's account details and recent security events, for the admin area.
 * Looking is recorded in the audit log. Returns null if there is no such user.
 */
export async function getUserForAdmin(
	admin: SessionUser,
	userId: string,
	context: RequestContext
): Promise<AdminUserDetails | null> {
	requireRole(admin, 'admin');

	const [row] = await db
		.select({
			...summaryColumns,
			banReason: users.banReason,
			deletionRequestedAt: users.deletionRequestedAt,
			twoFactorEnabled: users.twoFactorEnabled
		})
		.from(users)
		.where(eq(users.id, userId));
	if (!row) return null;

	const id = toUserId(row.id);
	const connections = await listConnections(id);
	const [{ passkeyCount }] = await db
		.select({ passkeyCount: count() })
		.from(passkeys)
		.where(eq(passkeys.userId, id));
	const recentActivity = await listSecurityActivity(id, 20);

	await recordAuditEvent(admin.id, 'admin_viewed_user', id, context);

	return {
		id,
		name: row.name,
		email: row.email,
		username: row.username,
		role: toRole(row.role),
		emailVerified: row.emailVerified,
		suspended: row.banned,
		createdAt: row.createdAt,
		suspensionReason: row.banReason,
		deletionRequestedAt: row.deletionRequestedAt,
		twoStepOn: row.twoFactorEnabled,
		hasPassword: connections.hasPassword,
		providers: connections.providers
			.filter((entry) => entry.connected)
			.map((entry) => entry.provider),
		passkeyCount,
		recentActivity
	};
}
