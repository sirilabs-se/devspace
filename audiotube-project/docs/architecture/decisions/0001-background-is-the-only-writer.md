# 0001. The background service worker is the only writer of stored state

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | System |
| **Supersedes** | — |

## Context

Several parts of the extension change the same values: the side panel switch and the overlay's Show video button both change audio-only mode (`PLY-001`), and several windows can be open at once (`GLB-013`, `GLB-014`). Later, the Save picker on YouTube's pages and the side panel will both change playlists. If each part wrote storage itself, two writers could overwrite each other's changes, and the rules (validation, limits) would have to be repeated in every context.

## Decision

Only the background service worker writes to `chrome.storage`. Every other context sends it a typed request and learns the result from the reply and from storage change events. Reading goes through small read helpers in `shared/`, which apply each value's defaults and validation.

- Only `background/` MUST write to `chrome.storage` (set, remove, clear).
- Reading stored values MUST go through the read helpers in `shared/`. `.svelte` files MUST NOT touch storage.
- The background MUST validate a value with the same schema the readers use before writing it.
- The background MUST accept runtime messages only from this extension.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Every context reads and writes storage directly | Two writers can overwrite each other; rules repeated in every context |
| Every context asks the background even to read | Adds a message round trip and a reconnect path when the worker restarts, for no gain: reads can't conflict |

## Consequences

**Good:**

- One place holds the rules for every change
- Readers stay simple: read once, then follow change events
- Concurrent changes from several windows are applied one after another

**Trade-offs:**

- Every change is a message, and needs a typed request and reply
- If the background is unreachable, changes fail; the sender must show that (`GLB-009`)

## Revisit When

- A change needs to be applied faster than a message round trip allows
