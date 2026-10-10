# Spike: the playback tab

**Questions:** What do Chrome and YouTube allow for the playback tab, so tasks 17 to 21 are built on facts?
(`PLY-041`, `PLY-043`, `PLY-044`, `PLY-050`, `PLY-053`, `OQ-001`.)

**Date:** 2026-10-10 · **Method:** throwaway scripts on real YouTube, Chromium 153 driven by Playwright,
signed out, consent accepted, with the built extension loaded. The scripts were not kept.

**Limits of this environment (read first).** The browser ran headless, and a short headed run on the desktop
behaved the same: a tab created with `active: false` reports `document.visibilityState` as `visible`, so it
is **not a true background tab**. Chrome's rules for media in tabs that have never been shown, and its
automatic tab discarding under memory pressure, could not be reproduced here. Items 1, 2 and 3 below are
therefore a best case and need a manual check in a normal, headed Chrome (listed at the end). Signed-in
behaviour was not tested either.

## Answers

| # | Question | Finding |
|---|---|---|
| 1 | Does a tab opened with `chrome.tabs.create({ active: false })` at `watch?v=ID&t=Ns` start playing without being shown? | **Yes, here.** With no user gesture and the default autoplay policy it was playing (`getPlayerState() === 1`) about 3 to 6 seconds after creation, never shown. `playVideo()` from the page was not needed. In a real background tab Chrome may hold it back (see "Needs a manual check") |
| 2 | Does it start at the saved position? | **Yes.** `&t=120s` gave position 120.0 while cued and 122.1 two seconds after playing began, i.e. within about 2 seconds of the saved position once playing. Position then advanced in real time |
| 3 | Does `chrome.tabs.update(id, { autoDiscardable: false })` keep the tab from being discarded? | The call works and `autoDiscardable` reads back `false`. It stops **automatic** discarding only: an explicit `chrome.tabs.discard(id)` still discards the tab. No side effects seen. Actual memory-pressure discarding could not be reproduced here |
| 4 | Leaving the video page in the same tab: does the mini-player keep the audio going (`PLY-044`)? | **Not by itself, here.** Moving from a playing watch page to the home page (logo click) or to search results in-page, the video **stopped** (state 5, player 0 × 0). A full page load also ends it. The mini-player appears only when the user asks for it (the `I` key or the mini-player button); then the audio continues. Asking for the mini-player from a `yt-navigate-start` handler did not help (the path has already changed when that event fires) |
| 5 | Can the page script load a video into the player on a non-watch page (`PLY-043`)? | **Yes, once the mini-player is open.** `loadVideoById(id)` and `loadVideoById({ videoId, startSeconds })` on `/` loaded and played the new video in the mini-player, with no navigation |
| 6 | Player facts for Now Playing | See "Player facts" below |
| 7 | Do hover previews, Shorts and embeds use `#movie_player`? | **Hover previews: no**, they use `#inline-player` inside `ytd-video-preview`. **Embeds: yes**, `/embed/ID` on `www.youtube.com` has its own `#movie_player` (the content script matches that path). **Shorts:** not confirmed (the feed would not load here; a Short's own page was redirected to `/watch`). **The home page keeps a `#movie_player` in the DOM at 0 × 0** from earlier watch pages |
| 8 | Which `chrome.tabs` events show a tab lost? | See "Tab lost" below |

## Player facts (for task 17)

On `#movie_player`, in the page's own world:

| Need | Source | Notes |
|---|---|---|
| Video ID, title, channel | `getVideoData()` → `video_id`, `title`, `author` | Also `isLive`, `isPremiere`, `isPlayable`, `errorCode` |
| Duration | `getDuration()` | Seconds; 0 or very large for live |
| Live flag | `getVideoData().isLive` | |
| Play state | `getPlayerState()` | `-1` unstarted, `0` ended, `1` playing, `2` paused, `3` buffering, `5` cued. `addEventListener('onStateChange', name)` exists |
| Position | `getCurrentTime()` | Seconds, with decimals |
| Ad playing | the class `ad-showing` on `#movie_player` | As in the quality spike |
| New video | `getVideoData().video_id` changes; `yt-navigate-finish` fires on the document after an in-page move | Order on a move: `yt-navigate-start`, `yt-navigate`, `yt-page-type-changed`, `yt-page-data-updated`, `yt-navigate-finish` |

They held in the mini-player and after in-page moves (the same element is re-used). The player reports
state `5` and size 0 × 0 on a page that is not a watch page and has no mini-player.

## Tab lost (events seen)

| What happened | What Chrome reported |
|---|---|
| Tab moved to another site | `tabs.onUpdated` with `{ status: 'loading' }`, then `{ status: 'complete' }`. **No `url`** in either (the extension has no host access to the new site) |
| Tab closed | `tabs.onRemoved` (documented; not captured in this run because the harness closed first) |
| Tab discarded | `tabs.onUpdated` with `{ discarded: true }` (documented; Playwright reported the page as closed, so not captured) |
| Tab crashed (`Page.crash`) | **No event.** `chrome.tabs.get(id)` afterwards reports `status: 'unloaded'` |

So a crash can only be found by looking: the playback tab sends a position every 5 seconds while playing,
and a report that goes missing is the signal to check `chrome.tabs.get`.

## Recommendation

**Task 17 (Now Playing).** Build on the facts above. The page script reads `getVideoData()`, `getDuration()`,
`getPlayerState()` and `getCurrentTime()`, reports on `onStateChange` and on `yt-navigate-finish`, and every
5 seconds while playing. Report only for a `#movie_player` that is on a watch path or inside `ytd-miniplayer`
(hover previews are already excluded by the id; the embed page and the hidden home-page player by that
rule).

**Task 20 (lost, and Resume).**

- *Lost* means any of: `tabs.onRemoved`; `tabs.onUpdated` with `status: 'loading'` on the playback tab (a
  full page load ends the video, so it counts, and if the new page is YouTube and plays, it takes the role
  again); `tabs.onUpdated` with `discarded: true`; or `chrome.tabs.get` failing or reporting
  `status: 'unloaded'` when checked. Check on service worker start, when the side panel opens, and when a
  position report is late (more than about 15 seconds while the state says playing).
- *Resume* opens `watch?v=ID&t=<saved position>s` with `active: false` and records that tab as the playback
  tab straight away, with state `paused`, so Go to video and Play work on it while it starts. If the player
  does not report `playing` within about 10 seconds, the side panel says that playback is waiting and offers
  Go to video. This is the "open in the background and let it start when the user looks at it" option from
  the plan, chosen because it never moves focus and needs nothing the extension doesn't have.
- Mark the playback tab `autoDiscardable: false` while it is the playback tab, and clear it when it stops
  being one.

**Task 21 (moving around in the playback tab).** YouTube does not keep a video going on its own when the
user leaves a watch page by a normal link; it only does so through the mini-player. Two things follow:

1. A move to another YouTube page that leaves the player stopped (state `5`, size 0) is **not** the tab
   being lost: the tab is alive, Now Playing and the playback tab stay, and the state is `paused` at the
   position last seen. Play from the side panel then reloads the video with
   `loadVideoById({ videoId, startSeconds })` in whatever player the page has.
2. The extension does not try to force the mini-player open (the one attempt failed, and it would change
   what YouTube does, which `GLB-004` and the design constraint argue against). `PLY-044` is met only when
   the user opens the mini-player themselves; this should be recorded against the requirement.

## Needs a manual check in a normal, headed Chrome

- A tab created with `active: false` really starts playing, and how long it takes (task 20's manual check).
- Whether `autoDiscardable: false` keeps a playing background tab alive under memory pressure
  (`chrome://discards` can discard a tab on demand to test the recovery path).
- Whether YouTube's mini-player appears on its own when leaving a watch page in a signed-in browser.
- A Short's player id, to confirm it is not `#movie_player`.

## Results of the manual checks (normal, headed Chrome)

To be filled in by the owner, one line each, with the date and Chrome version. Until then they are open.

| Check | How | Result |
|---|---|---|
| A Resume tab opened in the background really starts playing | Play a video, close its tab, press Resume in the side panel, and watch whether the new tab (not shown) starts playing and how long it takes | _not yet done_ |
| Disabling the extension with audio-only on leaves the video visible | With a watch page open and audio-only on, disable the extension in `chrome://extensions` and look at the open page | _not yet done_ |
| Discarding the playback tab shows Resume | Play a video, open `chrome://discards`, discard the playing tab, look at the side panel | _not yet done_ |
| Whether YouTube's mini-player appears by itself when signed in | Signed in, play a video, leave the watch page by a normal link (logo or search) and see whether it keeps playing in the mini-player | _not yet done_ |
