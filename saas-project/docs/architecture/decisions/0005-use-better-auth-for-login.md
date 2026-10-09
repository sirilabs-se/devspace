# 0005. Use Better Auth for login, with sessions stored in the database

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | Identity |
| **Supersedes** | — |

## Context

Identity needs email and password login, Google and Facebook, usernames, passkeys, a second step, backup codes, trusted devices, admin roles, suspension and impersonation. Writing all of that by hand would take one person months, and mistakes in it are security problems. The owner prefers an open-source library, and user data must stay in our own EU-hosted database.

## Decision

Use Better Auth, an open-source (MIT licence) login library that runs inside the app and stores everything in our PostgreSQL database. Sessions are rows in the database, identified by a session cookie.

- Only the Identity module MUST import the login library. All other code goes through Identity's `index.ts`.
- Pages SHOULD call Identity's functions from form actions. The library's own HTTP endpoints under `/api/auth/` are used only where plain HTTP is required: the Google and Facebook return addresses and the passkey exchange.

Because Better Auth 1.7 supports SvelteKit 2 and not yet SvelteKit 3 (released 2026-10-01), the app starts on the latest SvelteKit 2.

What the library doesn't cover is written in the Identity module: login lockout, username change rules, consent records, the audit log, the deletion grace period, data export and notification preferences.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Write login by hand | The most work, and every security mistake would be ours to find |
| A hosted login service | A monthly cost, and user data held by a third party |

## Consequences

**Good:**

- Most of the feature list is covered by maintained, widely used code
- Free to use, with no per-user fee
- User data stays in our database
- Sessions in the database can be ended at once, which sign-out everywhere, suspension and password changes all need

**Trade-offs:**

- The library shapes seven of Identity's tables
- The app's SvelteKit version is tied to what the library supports
- Library upgrades need care, because they can change those tables
- Every request looks up the session in the database

## Revisit When

- Better Auth declares support for SvelteKit 3; upgrade then
- The library stops being maintained or changes its licence
