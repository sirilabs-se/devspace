# 0004. Use PostgreSQL with Drizzle migrations, hosted in the EU

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | System |
| **Supersedes** | — |

## Context

The app stores accounts, profiles and, later, groups and events: data with clear relationships. Users are in Sweden and then the Nordics, so GDPR applies. The app is built and run by one person, so the database should be a managed service with as little upkeep as possible.

## Decision

Use one PostgreSQL database for the whole app, as a managed service in an EU region. Access it with Drizzle, which also generates the migration files. All other stored data (files, email logs) also stays with EU-hosted providers.

- The database MUST change only through migration files.
- A migration that has been applied MUST NOT be edited. Write a new one.
- `schema.dbml` MUST be updated in the same commit as the migration.
- Changes that delete or rename existing data MUST be approved by the owner first.

The hosting provider is not chosen yet; see the system doc's Open Questions.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| SQLite | Simple, but awkward once the app runs as more than one copy, and managed EU hosting is less common |
| A document database such as MongoDB | The data has clear relationships between tables |
| Hand-written SQL migrations with no query library | More to write and keep in step with the code; the login library already works with Drizzle |

## Consequences

**Good:**

- Widely supported by EU hosting providers, with managed backups
- Rate limits and sessions can live in the same database, so no extra services
- Personal data stays in the EU

**Trade-offs:**

- Every schema change needs a migration
- The choice of providers is narrowed to those with EU regions

## Revisit When

- The app expands outside the EU and users elsewhere need data stored closer to them
