# 0004. Reach YouTube's player only through the page script

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | Content script, page script |
| **Supersedes** | — |

## Context

YouTube's player object (`#movie_player`, with methods such as `setPlaybackQualityRange`, `playVideo`, `getVideoData`) is only reachable from code running in the page's own world. The content script runs in an isolated world: it can change the page's markup and talk to the extension, but can't call the player's methods. The page script can call the player, but can't talk to the extension. These methods are not a public API and may change.

## Decision

All calls to YouTube's player go through the page script (`src/inject/`). The content script and the page script talk over typed `window.postMessage` messages in an envelope marked `source: 'audiotube'`. The content script relays between the page script and the background.

- Only `inject/` MUST call methods on YouTube's player object.
- Page messages MUST be typed, wrapped in the envelope, and ignored when they come from another window.
- The page can read and forge window messages. The content script MUST check every page message before acting on it, and MUST NOT let one change saved state.
- Every player call MUST tolerate the method being missing or throwing, and fail quietly.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Use the `<video>` element from the content script | Works for play and pause, but not for quality, video details or ads, so two ways would exist side by side |
| Inject code on demand with `chrome.scripting.executeScript` in the main world | A round trip through the background for every call, and no way for the page to report events |

## Consequences

**Good:**

- One place knows YouTube's internal player API, so a YouTube change is fixed in one folder
- The page script holds no extension privileges, so a forged page message can do little

**Trade-offs:**

- Two hops (page → content → background) for every player event
- The page script can be seen and called by YouTube's own scripts

## Revisit When

- YouTube offers a supported way to control its player from an extension
