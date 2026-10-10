# 0005. The latest tab to start playing is the playback tab

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-10 |
| **Scope** | System |
| **Supersedes** | — |

## Context

There must be at most one playback tab across all windows (`GLB-001`), and when a video starts playing in another YouTube tab, that tab takes over and the old one is paused, not closed (`PLY-040`). The user also plays videos on YouTube without the extension, and those become Now Playing too (`PLY-038`). YouTube shows other players that are not the main one: hover previews on the home page, Shorts, embeds.

## Decision

The background decides which tab is the playback tab. Each tab's content script reports its main player's video and state (`player/video`, `player/state`). When a tab reports `playing`, the background makes it the playback tab, stores Now Playing from that tab's video, and sends `player/command (pause)` to the previous playback tab if it is a different tab.

- Only the main player counts: `#movie_player` on a watch page or inside YouTube's mini-player. Hover previews, Shorts and embeds MUST NOT become Now Playing.
- The background MUST take the tab from the message's sender, never from its body.
- Only the playback tab's reports MAY change Now Playing, except a `playing` report, which makes its tab the playback tab first.
- The playback tab MUST be kept in `chrome.storage.session` (ADR 0003), with the tab marked as not discardable while it is the playback tab (`PLY-050`). `autoDiscardable: false` stops only automatic discarding; an explicit discard still works ([spike](../../spikes/playback-tab.md)).
- A tab is lost when it is closed, starts a full page load, is discarded, or is found `unloaded` when checked. A crash raises no event, so a late position report triggers a check ([spike](../../spikes/playback-tab.md)).
- A page that is not a watch page and has no mini-player has no main player, even though `#movie_player` may still be in its DOM.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| The tab the user last focused is the playback tab | Focusing a tab doesn't start audio; the user may look at another video without playing it |
| The first tab to play keeps the role until it closes | Contradicts `PLY-040` |
| Each tab decides for itself | Tabs can't see each other; two could both think they are playing |

## Consequences

**Good:**

- One rule, in one place, that matches what users expect from YouTube itself
- Works the same for videos started by the extension and by the user on YouTube

**Trade-offs:**

- A tab that autoplays when opened takes over the playback tab, as on YouTube. Chrome holds back media in tabs that have never been shown, which limits this in practice
- Every YouTube tab reports its player's state, even when audio-only is off

## Revisit When

- Users find their listening interrupted by tabs they opened only to look at
