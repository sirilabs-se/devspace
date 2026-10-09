# 0006. Keep one append-only audit log for security activity and admin actions

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | Identity |
| **Supersedes** | — |

## Context

Users need to see their own security activity (logins, password and email changes). Admin actions such as suspension and impersonation need a record that can't be altered afterwards. GDPR also requires that a deleted user's personal data is removed, and that data isn't kept longer than needed.

## Decision

Keep one table, `audit_events`, for both. A user's security activity page is a filtered view of it; the admin audit log is the whole table.

- `audit_events` rows MUST NOT be edited. Only two changes are allowed: permanent account deletion empties the user links, IP address and device details; the retention job deletes rows older than 12 months. The database itself rejects any other change.
- Passwords, secrets and tokens MUST NOT appear in audit entries.
- Entry details SHOULD hold no personal information beyond the user links, IP address and device details.

Other modules add entries through Identity's `recordAuditEvent` function.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Separate tables for user security activity and admin audit | Two tables with the same shape and the same rules |
| A fully immutable log, never changed or deleted | Conflicts with GDPR deletion and with keeping data no longer than needed |

## Consequences

**Good:**

- One place to look for what happened to an account
- Tampering is blocked by the database, not only by code

**Trade-offs:**

- After a user is deleted, their entries remain but no longer say who they were about
- Entries older than 12 months are gone

## Revisit When

- Several modules write large volumes of entries, and the log deserves its own module
- A legal requirement calls for a longer retention period
