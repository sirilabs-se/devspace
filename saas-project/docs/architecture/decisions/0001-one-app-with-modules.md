# 0001. Build as one deployable app with modules

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | System |
| **Supersedes** | — |

## Context

The app will grow to many areas (identity, groups, events and more), added one at a time by a solo builder working with AI coding agents. The areas need clear boundaries so each can be built and changed without breaking the others, but running several separate services would multiply the upkeep.

## Decision

Build one SvelteKit app, deployed as a single unit with one database. SvelteKit's own server (load functions, form actions, API routes) is the backend. Inside it, each area is a module in `src/lib/server/modules/<name>` with its own tables.

- A module's public API is exactly what its `index.ts` exports. Other code MUST import a module only through its `index.ts`.
- Modules MUST NOT import each other in a loop.
- A module MUST NOT read or write another module's tables.
- Shared helpers MUST NOT contain business logic.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Separate backend service behind SvelteKit | Nothing in the requirements needs it, and a second deployable doubles the upkeep |
| One service per area | Far too much to run and deploy for one person |
| One app with no module boundaries | Areas would tangle as the app grows, making later changes risky |

## Consequences

**Good:**

- One thing to deploy, monitor and pay for
- Each module can be understood and tested on its own
- A module can be moved into its own service later, because its boundary is already clear

**Trade-offs:**

- All modules scale together
- The boundaries are kept by lint rules and review, not by the network

## Revisit When

- One module needs very different scaling or uptime from the rest
- A separate team takes over a module and needs to deploy it independently
