# 0003. Private data belongs to users, with no separation by company

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | System |
| **Supersedes** | — |

## Context

The project templates assume a business app where every piece of data belongs to a customer company and companies must never see each other's data. This app is a Meetup-style community for individuals: most data (groups, events) is public or shared, and private data belongs to one person. There are no organizations.

## Decision

There are no companies, tenants or workspaces. Private data belongs directly to a user.

- Every server function that reads or writes a user's private data MUST take the acting `UserId` and limit its queries to that user.
- The acting user MUST come from `event.locals` (set in `hooks.server.ts`) and be passed down explicitly. It MUST NOT come from global state or straight from request input.
- Every feature that stores private data MUST have a test proving one user can't read or change another user's private data.

Admin functions are the exception: they act on other users' data, and MUST check the admin role instead.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Give each user a personal workspace, so organizations can slot in later | Adds a concept to every table and query that a community app doesn't use |
| Keep the templates' company separation | There are no companies to separate |

## Consequences

**Good:**

- A simpler data model that matches how the app is used
- One clear rule for private data, enforced by the type checker

**Trade-offs:**

- Adding organizations later would mean reshaping who owns what
- Shared data (groups, events) will need its own permission rules when those modules are designed

## Revisit When

- Organizations or paid team accounts become a requirement
