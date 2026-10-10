# 0006. The overlay covers every YouTube tab, not only the playback tab

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | Content script |
| **Supersedes** | — |

## Context

In phases 1 and 2 there was no playback tab, so every YouTube tab showing a player got the overlay while audio-only was on (build plan decisions c and j). Phase 3 adds the playback tab, so the overlay could be limited to it. `PLY-006` says the overlay is applied to "the main video player on YouTube watch pages", without limiting it to one tab, and audio-only mode is one value for the whole extension (`PLY-001`).

## Decision

Keep the overlay on every YouTube tab's main player while audio-only is on. The playback tab decides what is Now Playing, not where the overlay appears.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Only the playback tab gets the overlay | A second video the user opens would show its picture, although audio-only is on; the overlay would jump between tabs as the playback tab changes |

## Consequences

**Good:**

- What the user sees follows the one audio-only switch, everywhere
- No change to the built content script

**Trade-offs:**

- A user who wants to watch one video while listening to another must turn audio-only off for both

## Revisit When

- Users ask to watch one tab while listening in another
