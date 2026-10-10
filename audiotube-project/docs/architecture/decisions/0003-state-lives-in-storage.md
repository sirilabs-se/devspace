# 0003. State lives in `chrome.storage`, never only in the service worker's memory

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | System |
| **Supersedes** | — |

## Context

A Manifest V3 background is a service worker: Chrome stops it after about 30 seconds without events and starts it again when needed. Anything kept only in its memory is lost at that moment, without warning. Some state must survive a browser restart (audio-only mode, Now Playing and its position); some must not (tab IDs, which are only valid until the browser closes).

## Decision

All state the extension depends on is kept in `chrome.storage`:

- `chrome.storage.local` for what must survive a restart (settings, Now Playing).
- `chrome.storage.session` for what belongs to this browser session only (the playback tab, each tab's overlay status).

The service worker may cache values in memory to save reads, but MUST treat storage as the truth and work correctly after a restart at any point.

- Event listeners MUST be registered synchronously when the service worker starts, so no event is missed after a restart.
- A timer the user depends on (for example a sleep timer, later) MUST NOT live only in the service worker; it runs where a page is open, or is recomputed from stored times.
- Values read from storage MUST be checked; a missing or invalid value reads as its default or as absent.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Keep state in the worker's memory and keep the worker alive | Chrome limits keep-alive tricks, they cost battery, and a crash would still lose everything |
| An offscreen document holding state | Another context to manage, with no gain over storage |
| IndexedDB | Not needed at today's sizes; may be chosen later for large video records (see the system doc, "If Storage Grows") |

## Consequences

**Good:**

- A worker restart, an extension update or a browser restart loses nothing it shouldn't
- Every context can read the same state and follow its changes
- A browser restart clears session state by itself, which matches `PLY-054`

**Trade-offs:**

- Fast-changing values (playback position) can't go through storage every second; they are saved at most every 5 seconds (`PLY-130`), and the live progress bar (later) will need its own channel
