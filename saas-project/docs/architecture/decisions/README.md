# Decision Log

This folder records important design decisions as ADRs (Architecture Decision Records): short notes explaining what was decided and why. There is one log for the whole app; each ADR's **Scope** says whether it affects the whole system or one module.

## When to write an ADR

Write one only for decisions that would be costly to change later, such as the database, hosting, login method, how modules talk to each other, or a module's main design choice. Small, easily reversed choices don't need one.

## How to add one

1. Copy [`0000-template.md`](0000-template.md) to the next unused number, e.g. `0003-use-email-login.md` (lowercase, words joined by hyphens).
2. Fill it in, including the scope and status.
3. Add a row to the table below.

## Changing a decision

Don't rewrite the decision in an accepted ADR. Instead:

1. Write a new ADR for the new decision, and fill in its **Supersedes** field.
2. In the old ADR, change only the status to "Superseded by NNNN".
3. Update both rows in the table below.

Fixing typos or broken links in an old ADR is fine.

## Statuses

| Status | Meaning |
|---|---|
| Proposed | Under discussion, not decided yet |
| Accepted | Decided and in effect |
| Superseded | Replaced by a later ADR |
| Rejected | Considered and decided against |

## Decisions

| # | Title | Scope | Status | Date |
|---|---|---|---|---|
| [0001](0001-one-app-with-modules.md) | Build as one deployable app with modules | System | Accepted | 2026-10-09 |
| [0002](0002-keep-the-design-replaceable.md) | Keep the design replaceable | System | Accepted | 2026-10-09 |
| [0003](0003-private-data-belongs-to-users.md) | Private data belongs to users, with no separation by company | System | Accepted | 2026-10-09 |
| [0004](0004-use-postgresql-with-drizzle-in-the-eu.md) | Use PostgreSQL with Drizzle migrations, hosted in the EU | System | Accepted | 2026-10-09 |
| [0005](0005-use-better-auth-for-login.md) | Use Better Auth for login, with sessions stored in the database | Identity | Accepted | 2026-10-09 |
| [0006](0006-one-append-only-audit-log.md) | Keep one append-only audit log for security activity and admin actions | Identity | Accepted | 2026-10-09 |
