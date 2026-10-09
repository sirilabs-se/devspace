---
paths:
  - "src/lib/server/**"
  - "src/hooks.server.ts"
  - "src/routes/**/*.server.ts"
---

# Server code

The MUST rules for modules, private data and the database are in `CLAUDE.md`. This file adds how to follow them. The system doc (`docs/architecture/README.md`, "How Modules Work Together" and "Cross-Cutting Concerns") is the source of truth if anything here differs.

- A module's `index.ts` SHOULD export only functions and types other modules need. Everything else stays internal.
- When one action changes data in two modules, the calling module SHOULD start the database transaction and pass it to the other module's public function.
- `UserId` SHOULD be a distinct type (not a plain string), so the type checker catches a missing or wrong user.
- Load functions and form actions SHOULD stay thin: check input, call one module function, return plain data.
- Domain errors SHOULD use typed error codes, turned into the shared API error format at the edge (form actions and API routes).
