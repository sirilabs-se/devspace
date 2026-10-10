# [NNNN]. [Short decision title, e.g. Use PostgreSQL for the database]

| | |
|---|---|
| **Status** | Proposed / Accepted / Superseded by [NNNN](NNNN-title.md) / Rejected |
| **Date** | YYYY-MM-DD |
| **Scope** | System / [Module, e.g. background] |
| **Supersedes** | [NNNN](NNNN-title.md) or — |

## Context

[What situation or requirement forced a decision? Keep it to the facts that mattered.]

## Decision

[What was decided, in one or two sentences.]

<!--
If the decision constrains code, state it as MUST / SHOULD / MAY rules, e.g.
"Modules MUST NOT import each other in a loop." Add each MUST to the Architecture Checks
table in the system doc.
-->

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| [e.g. MongoDB] | [e.g. Our data has clear relationships between tables] |
| [e.g. SQLite] | [e.g. Hosting platform doesn't keep files between restarts] |

## Consequences

**Good:**

- [e.g. Well supported on free hosting tiers]

**Trade-offs:**

- [e.g. Schema changes need migrations]

## Revisit When

<!-- What would make this decision worth looking at again. Delete if nothing obvious. -->

- [e.g. We need full-text search beyond simple title matching]
