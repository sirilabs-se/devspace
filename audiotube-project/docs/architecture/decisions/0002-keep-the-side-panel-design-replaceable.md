# 0002. Keep the side panel design replaceable

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | Side panel |
| **Supersedes** | — |

## Context

The side panel's look (colours, components, layout) is expected to be replaced with a new design at some point. That must be possible without touching business logic, state or how screens behave. The overlay and buttons on YouTube's pages are small and fixed; the background has no UI.

## Decision

Keep the side panel's look in `sidepanel/ui/` and its theme file `sidepanel/ui/theme.css`. Everything else is independent of it.

The test: replacing `sidepanel/ui/` and its tokens must not require changing anything in `sidepanel/core/`, the background, the content script, the page script, or any non-UI test.

- Business rules, validation and storage access MUST NOT be in `.svelte` files.
- `sidepanel/core/` MUST NOT import from `sidepanel/ui/`, and MUST NOT contain Svelte components.
- Colours, fonts, spacing, corner radii and shadows MUST come from design tokens in `sidepanel/ui/theme.css`; Tailwind's theme is built only from those tokens.
- A component library, icon set or CSS framework MUST be imported only inside `sidepanel/ui/`.
- Logic tests MUST NOT import `.svelte` files or anything from `sidepanel/ui/`.
- `sidepanel/ui/` component props SHOULD be named by meaning, not appearance.
- Svelte components SHOULD stay presentational, calling into `sidepanel/core/` for all state and behaviour.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Style screens directly, with no separate UI layer | A redesign would mean editing logic too, with a risk of breaking behaviour |
| Apply the same rule to what is added to YouTube's pages | That UI is small, fixed and must match YouTube rather than the panel; the rule would cost more than it saves |

## Consequences

**Good:**

- A redesign is contained to one folder and one theme file
- Logic tests keep passing through a redesign

**Trade-offs:**

- Every new visual element needs a `sidepanel/ui` component first
