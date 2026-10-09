# 0002. Keep the design replaceable

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Scope** | System |
| **Supersedes** | — |

## Context

The app's look (colours, components, layout) is expected to be replaced with a new design at some point. That must be possible without touching business logic, data or how screens behave.

## Decision

Keep the look in three places only: `src/lib/ui/`, the theme file `src/lib/ui/theme.css`, and the app shell `src/routes/+layout.svelte`. Everything else is independent of it.

The test: replacing those three must not require changing any server code, load function, form action or non-UI test.

- Business rules, validation, permissions and database access MUST live only in `src/lib/server/`, never in `.svelte` files.
- Load functions and form actions MUST return plain data, never styling (CSS classes, colours, icon names).
- Colours, fonts, spacing, corner radii and shadows MUST come from design tokens in `src/lib/ui/theme.css`.
- A component library, icon set or CSS framework MUST be imported only inside `src/lib/ui/`.
- Logic tests MUST NOT import `.svelte` files or `$lib/ui`.
- `$lib/ui` component props SHOULD be named by meaning, not appearance: `variant="danger"`, not `color="red"`.
- Pages SHOULD build screens from `$lib/ui` components, with no styling beyond simple arrangement.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Style pages directly, with no separate UI layer | A redesign would mean editing every page, with a risk of breaking behaviour |
| Use a component library directly in pages | Swapping the library later would touch every page |

## Consequences

**Good:**

- A redesign is contained to one folder, one theme file and the app shell
- Logic tests keep passing through a redesign

**Trade-offs:**

- Every new visual element needs a `$lib/ui` component first
- Pages can't take styling shortcuts
