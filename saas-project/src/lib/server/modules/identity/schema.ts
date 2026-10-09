// Identity's database tables, read by drizzle-kit to generate migrations.
// The source of truth for the design is docs/architecture/database/schema.dbml.
// users, accounts, sessions and verifications are shaped by the login library.
import {
	bigint,
	boolean,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

export const users = pgTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: varchar('email').notNull().unique(),
		emailVerified: boolean('email_verified').notNull().default(false),
		name: varchar('name').notNull(),
		username: varchar('username').unique(),
		displayUsername: varchar('display_username'),
		image: varchar('image'),
		role: varchar('role').notNull().default('user'),
		banned: boolean('banned').notNull().default(false),
		banReason: varchar('ban_reason'),
		banExpires: timestamp('ban_expires', { withTimezone: true }),
		twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
		locale: varchar('locale').notNull().default('en'),
		timeZone: varchar('time_zone').notNull().default('UTC'),
		usernameChangedAt: timestamp('username_changed_at', { withTimezone: true }),
		deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('users_deletion_requested_at_idx').on(table.deletionRequestedAt)]
);

export const accounts = pgTable(
	'accounts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		providerId: varchar('provider_id').notNull(),
		accountId: varchar('account_id').notNull(),
		password: varchar('password'),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: varchar('scope'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('accounts_user_id_idx').on(table.userId),
		uniqueIndex('accounts_provider_account_idx').on(table.providerId, table.accountId)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: varchar('token').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		ipAddress: varchar('ip_address'),
		userAgent: varchar('user_agent'),
		impersonatedBy: text('impersonated_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('sessions_user_id_idx').on(table.userId)]
);

export const verifications = pgTable(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: varchar('identifier').notNull(),
		value: varchar('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('verifications_identifier_idx').on(table.identifier)]
);

export const consentDocument = pgEnum('consent_document', ['terms', 'privacy', 'age_confirmation']);

export const consents = pgTable(
	'consents',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		document: consentDocument('document').notNull(),
		version: varchar('version').notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('consents_user_id_idx').on(table.userId)]
);

// Append-only. A database trigger (see the migration) rejects edits; see ADR 0006.
export const auditEvents = pgTable(
	'audit_events',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
		subjectUserId: text('subject_user_id').references(() => users.id, { onDelete: 'set null' }),
		action: varchar('action').notNull(),
		details: jsonb('details').$type<AuditDetails>(),
		ipAddress: varchar('ip_address'),
		userAgent: varchar('user_agent'),
		createdAt: createdAt()
	},
	(table) => [
		index('audit_events_subject_created_idx').on(table.subjectUserId, table.createdAt),
		index('audit_events_created_at_idx').on(table.createdAt)
	]
);

/** Extra facts about an audited action. Never personal information, passwords or tokens. */
export type AuditDetails = Record<string, string | number | boolean | null>;
