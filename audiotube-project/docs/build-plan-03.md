# AudioTube — Build Plan, Phase 3

| | |
|---|---|
| **Status** | Tasks 15 to 21 done |
| **Last updated** | 2026-10-10 |
| **Design** | [Requirements](audiotube_requirements.md), [System design](architecture.md), [Decisions](architecture/decisions/README.md), [Stored data](architecture/storage.dbml) |
| **Earlier phases** | [build-plan-01.md](build-plan-01.md): audio-only mode, tasks 1 to 7 · [build-plan-02.md](build-plan-02.md): the rest of the overlay, tasks 8 to 14 |

Each task is a thin slice that works end to end, small enough for one coding session. Don't rewrite tasks that are done; add a new task for follow-up work.

The side panel is built to match the prototype, `extension/_prototype/`: its look, layout, states and wording. The requirements decide scope and rules. The prototype is a reference only and is never shipped.

**Phase 3 — Where audio plays from** (section 4.4, with the parts of 4.3, 4.5 and 4.9 needed to see and control it): tasks 15 to 21. Task 15 first fixes what the review of phase 2 found and adds the new architecture checks. Task 16 is a spike that decides how tasks 20 and 21 are built. Earlier decisions a to l still apply unless a decision below replaces one. Sections 5 to 7 are not started.

## Decide before the task that needs it

| Decision | Needed by |
|---|---|
| Overlay on every YouTube tab, or only the playback tab ([ADR 0006](architecture/decisions/0006-overlay-on-every-youtube-tab.md)). Suggested: every tab, as now | Task 18 |
| How Resume works if the spike finds a tab opened in the background won't start playing until it is shown. Options: open it in the background and let it start when the user looks at it, with the side panel saying so; reuse an existing YouTube tab; or briefly show the new tab. Suggested: decide from the spike's findings | Task 20 |
| What to do if YouTube does not keep playing in its mini-player when the user leaves the video page (`PLY-044`). Suggested: decide from the spike's findings | Task 21 |

## Decisions for phase 3

These apply to this phase only and do not change the requirements document.

| # | Decision | Revisit |
|---|---|---|
| m | Now Playing carries its own copy of the video's details (ID, title, channel, duration, live). Shared video records (`PLS-073` to `PLS-081`) wait for the Queue phase, which decides how they are stored, with an ADR | Section 5 |
| n | Thumbnails load from YouTube's image server (`i.ytimg.com`) by video ID. This is the only network request the extension itself makes | — |
| o | Nothing from section 5 is built. When a video ends, nothing extra happens and YouTube behaves as usual. There is no Previous record, so `PLY-046` waits; `PLY-038`'s report to the Queue, `PLY-041`, `PLY-042`, `PLY-043` and `PLY-047` wait too. The spike still records what it finds for `PLY-041` and `PLY-043` | Section 5 |
| p | Stop (`PLY-070`, `QUE-077`) is not built. Now Playing is replaced when another video plays; "Nothing playing" shows only before the first video | Sections 4.6, 5 |
| q | Only the main player counts: `#movie_player` on a watch page or in YouTube's mini-player ([ADR 0005](architecture/decisions/0005-latest-tab-to-play-is-the-playback-tab.md)) | — |
| r | The side panel gets a Now Playing card with thumbnail, title, channel, play/pause and Go to video. Progress, volume, Next and Previous, Up next and the panel mini-player come with sections 4.5 and 4.9 | Sections 4.5, 4.9 |

## Tasks

| # | Task | Requirements | Depends on | Status |
|---|---|---|---|---|
| 15 | Fixes from the phase 2 review, and the new architecture checks | GLB-009, ADR 0001, ADR 0004 | 14 | Done |
| 16 | Spike: the playback tab | PLY-041, PLY-043, PLY-044, PLY-050, PLY-053, OQ-001 | 15 | Done |
| 17 | Now Playing from YouTube's player | PLY-037, PLY-038, PLY-048, PLY-130 | 16 | Done |
| 18 | One playback tab across all windows | GLB-001, PLY-039, PLY-040, PLY-045 | 17 | Done |
| 19 | Now Playing in the side panel | PLY-036, PLY-051, PLY-055, PLY-056, PLY-057, PLY-115, PLY-119 | 17 | Done |
| 20 | Playback tab lost, and Resume | PLY-049, PLY-050, PLY-052, PLY-053, PLY-054 | 18, 19 | Done |
| 21 | Moving around in the playback tab | PLY-044, PLY-045 | 18 | Done |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

Task 15 comes first, then the spike. Tasks 18 and 19 can be done in either order after task 17. Task 14 is in [build-plan-02.md](build-plan-02.md).

## Task details

### 15. Fixes from the phase 2 review, and the new architecture checks

**Goal:** Close what the review of tasks 8 to 14 found, and add the checks the [system design](architecture.md) introduces, before phase 3 builds on them.

**Implements:** GLB-009, [ADR 0001](architecture/decisions/0001-background-is-the-only-writer.md), [ADR 0004](architecture/decisions/0004-reach-youtube-player-through-the-page-script.md)

**In scope:**

- **The picture can stay hidden after an update.** When a cut-off copy of the content script shuts down, it removes `data-audiotube-visible` from `<html>`, but the new copy may already have set it. On a page that was opened with audio-only on (so the early CSS is in it), with audio-only now off, the video goes blank with no overlay. Fix: a cut-off copy never removes the flag a newer copy owns. One way: each copy marks `<html>` with its own ID when it starts; a cut-off copy touches the flag only if the mark is still its own.
- **Disabling the extension while audio-only is on.** Check by hand whether Chrome keeps the early CSS in pages already open after the extension is disabled. If it does, the player stays black with no overlay. In that case a cut-off copy that is still the newest on the page (see above) sets the flag so the picture shows.
- **Storage helpers folder.** Rename `shared/settings/` to `shared/storage/`, since it now holds more than settings (overlay status, and in this phase Now Playing and the playback tab). Update the ESLint rule's paths.
- **New architecture checks** (see the system design's Architecture Checks):
  - `background`, `content` and `inject` never import each other (dependency-cruiser)
  - only `inject/` calls YouTube's player methods (`playVideo`, `pauseVideo`, `setPlaybackQualityRange`, `getVideoData` and the like), with an ESLint rule outside `inject/`
- **Doc tidy:** task 10 in `build-plan-02.md` has two "Notes" blocks; merge them (wording only, nothing about the task changes).

**Out of scope:**

- Any new feature

**Done when:**

- [x] On the test page: open a watch page with audio-only on, turn it off, reload the extension → the picture is visible and stays visible
- [x] The disable check has been done by hand, its result recorded in the notes, and fixed if needed
- [x] `npm run verify` fails when `content/` imports from `background/`, or when code outside `inject/` calls `playVideo` (then undo the break)
- [x] `shared/storage/` replaces `shared/settings/`, and `npm run verify` passes

**Notes:**

- Flag ownership: each copy of the content script marks `<html>` with its own ID (`data-audiotube-owner`). A cut-off copy touches the flag only while the mark is still its own, and then sets `data-audiotube-visible` so the picture shows (nothing will replace its overlay). A newer copy's flag is never removed. Covered by unit tests with a fake element and two browser tests (extension removed; a newer copy owning the mark).
- The disable check, by hand (headless Chromium 153, extension loaded with `--load-extension`, the stand-in for disabling being `chrome.runtime.reload()` with no restart): with audio-only on, the open page had the early CSS and an overlay. When the extension went away **Chrome kept the early CSS in the page** (taking the flag away hid the video again), so without the fix the player would have stayed black with no overlay. With the fix the cut-off copy set the flag: overlay gone, picture visible. Real "Disable" in `chrome://extensions` could not be driven from here and is the same unload path; worth one manual look.
- `shared/settings/` is now `shared/storage/`; the ESLint paths follow it. The ESLint config is organised as one block per kind of folder, because a later block replaces an earlier one's `no-restricted-syntax`.
- New checks, each proved by breaking it once and undoing it: `background`, `content` and `inject` importing each other (dependency-cruiser rule `contexts-never-import-each-other`), and calls of YouTube's player methods (`playVideo`, `getVideoData`, `setPlaybackQualityRange` and the like) outside `inject/` (ESLint).
- Doc tidy: task 10's two Notes blocks in `build-plan-02.md` are one. `CLAUDE.md` no longer says the architecture doc is not written.
- The new docs from you (`architecture.md`, `architecture/`, `build-plan-03.md`) are committed with this task.


### 16. Spike: the playback tab

**Goal:** Find out what Chrome and YouTube allow for the playback tab, so tasks 17 to 21 are built on facts.

**Implements:** OQ-001 (background tab, discarding, mini-player), groundwork for PLY-041, PLY-043, PLY-044, PLY-050, PLY-053

**In scope:** throwaway scripts on real YouTube, answering:

1. **Starting in a background tab.** Does a tab opened with `chrome.tabs.create({ active: false })` at `watch?v=ID&t=Ns` start playing without ever being shown? With a user's click in the side panel just before? If not, what does work without moving focus?
2. **Position.** Does it start at the saved position, within about 2 seconds?
3. **Discarding.** Does `chrome.tabs.update(id, { autoDiscardable: false })` keep the playback tab from being discarded? Any side effects?
4. **Leaving the video page.** In the same tab, moving from a watch page to the home page or a search: does YouTube's mini-player keep the audio going (`PLY-044`)? After a full page load too, or only in-page moves?
5. **Loading the next video without navigating** (`PLY-043`, for later): can the page script load a video into the player on a non-watch page, e.g. `loadVideoById`, and what does the page do?
6. **Player facts** for task 17: which methods and events give the video ID, title, channel, duration, live flag, play state, position and "ad playing"; do they hold in the mini-player and after in-page moves?
7. **Other players:** confirm hover previews, Shorts and embeds don't use `#movie_player`.
8. **Tab lost:** which `chrome.tabs` events show a tab closed, moved off YouTube, crashed or discarded?

**Out of scope:**

- Production code

**Done when:**

- [x] Findings in `docs/spikes/playback-tab.md`: what works, what doesn't, how reliable, and a recommendation for tasks 17, 20 and 21
- [x] [ADR 0005](architecture/decisions/0005-latest-tab-to-play-is-the-playback-tab.md) updated if the findings change it (it is still Proposed, so it can be edited)

**Notes:**

- Findings and recommendations are in `docs/spikes/playback-tab.md`. Headline: a background tab started playing by itself within seconds and at the saved position; the spike environment could not make a tab truly hidden, so that and real discarding need a manual check in a headed Chrome (listed in the spike).
- **Decision for task 20 (Resume):** open in the background, record the new tab as the playback tab at once with state `paused`, and if it has not reported `playing` within about 10 seconds say so in the side panel with Go to video.
- **Decision for task 21 (`PLY-044`):** YouTube stopped the video when the page was left by a normal link, and showed the mini-player only on request (`I` key or button). The extension will not force it. A move that stops the player leaves Now Playing and the playback tab in place as paused; Play then reloads the video at its position. `PLY-044` is met only when the user opens the mini-player.
- ADR 0005 is still Proposed; it gained the tab-lost rules and the `autoDiscardable` fact. It becomes Accepted in task 18.


### 17. Now Playing from YouTube's player

**Goal:** The background always knows the video in the playback tab, with its details, play state and position, and keeps it across a browser restart.

**Implements:** PLY-037, PLY-038 (without the Queue), PLY-048, PLY-130 (in part); decisions m and q

**In scope:**

- The page script reports its main player's video (`player/video`), play state (`player/state`) and, while playing, its position every 5 seconds (`player/position`), using what the spike found
- The content script checks each page message and forwards it to the background; the background takes the tab from the sender
- With a single YouTube tab: the tab that reports `playing` becomes the playback tab (`playbackTab` in session storage, marked not discardable); its video becomes Now Playing (`nowPlaying` in local storage, text capped at 300 and 100 characters); the position is saved on every report, on pause and on tab loss
- Read helpers in `shared/storage/` for both, with defaults and validation
- Test page additions: player methods and events matching what the spike found, and a hover-preview player that is not `#movie_player`

**Out of scope:**

- Several tabs — task 18
- Anything the side panel shows — task 19

**Done when:**

- [x] On the test page, playing a video stores Now Playing with its ID, title, channel, duration and live flag, and makes the tab the playback tab
- [x] Pausing stores the state and the position; while playing, the stored position is never more than 5 seconds old
- [x] The hover-preview player never becomes Now Playing
- [x] A title or channel longer than the cap is stored cut to the cap
- [x] After a browser restart (same profile), Now Playing is still stored and there is no playback tab
- [x] Playback continues with the tab in the background or its window minimised (manual check, `PLY-048`)
- [x] Logic tests cover the background's handling of each message, and the read helpers

**Notes:**

- Page script (`inject/`): `reporter.ts` turns what the main player shows into `player/video`, `player/state` and `player/position` reports (video details, play state with position, and the position every 5 seconds while playing; ad time is never sent as a position). It is driven by the player's `<video>` events and a 1 second beat, and by `yt-navigate-finish`. The main player is `#movie_player` on a watch path or inside `ytd-miniplayer` with a size; the helpers (`findMainPlayer`, `isWatchPath`, `isInMiniPlayer`) moved to `shared/youtube.ts` so the page and content scripts agree.
- Content script: checks each page report with `isPlayerReport` (the page can forge messages) and forwards it; nothing from the page can change saved state by itself.
- Background (`background/playback.ts`): applies reports one after another. A `player/video` report is kept per tab in session storage (`tabVideo:<tabId>`) so the details are there when that tab starts playing. A `playing` report from a tab that is not the playback tab makes it the playback tab, stores its video as Now Playing and sets `autoDiscardable: false`; the playback tab's pauses and positions update the state and position; a different video in the playback tab replaces Now Playing. A tab that only loads a video never changes anything. The tab and window come from the message's sender.
- Stored text is cleaned (control characters to spaces, whitespace collapsed) and capped at 300 and 100 characters; markup is kept as plain text.
- `shared/storage/` gained `now-playing.ts` and `playback-tab.ts` (schema, read and watch helpers with defaults, validation).
- Not in this task, by design: pausing the previous playback tab and giving back its discard mark (task 18), and noticing a lost tab (task 20).
- Browser tests use a test page whose player answers `getVideoData`, `getDuration` and `getCurrentTime` and keeps a clock, plus a hover-preview player (`#inline-player`). The restart test relaunches the same profile.
- Real YouTube (headless, signed out): playing stored the real title, channel and duration, the position was under 5 seconds old, playback continued with another tab in front, pausing stored the state and position, `autoDiscardable` read back false, and `loadVideoById` of another video replaced Now Playing. A minimised window (`PLY-048`) could not be tried here; the other-tab case stands in for it.


### 18. One playback tab across all windows

**Goal:** When a video starts playing in another YouTube tab, in any window, that tab takes over and the old one is paused, not closed.

**Implements:** GLB-001, PLY-039, PLY-040, PLY-045; [ADR 0005](architecture/decisions/0005-latest-tab-to-play-is-the-playback-tab.md), [ADR 0006](architecture/decisions/0006-overlay-on-every-youtube-tab.md)

**In scope:**

- When a tab other than the playback tab reports `playing`, it becomes the playback tab and its video Now Playing
- The background sends `player/command (pause)` to the old playback tab; its content script passes it to the page script, which pauses the player
- The old tab loses the "not discardable" mark; the new one gets it
- Opening a different video in the playback tab replaces Now Playing (`PLY-045`; the Previous record comes with section 5)
- Set ADRs 0005 and 0006 to Accepted, or as decided

**Out of scope:**

- The Previous record (`PLY-046`) — decision o

**Done when:**

- [x] With two test tabs: A plays; B plays → A is paused, not closed; B is the playback tab and Now Playing
- [x] The same with A and B in different windows
- [x] Opening another video in the playback tab replaces Now Playing
- [x] A paused tab, or a tab that only loads a video without playing it, never takes over
- [x] Manual check on real YouTube passes

**Notes:**

- When a tab other than the playback tab reports `playing` (and has reported its video), it becomes the playback tab and its video Now Playing; the background then sends `player/command (pause)` to the old playback tab with `chrome.tabs.sendMessage`, and moves the discard mark (`autoDiscardable: true` to the old tab, `false` to the new). The old tab is never closed, and a failed send (the tab is gone) does not stop the take-over.
- The command goes background → that tab's content script → page script, which pauses through the player (or the `<video>` element if the methods are missing). The content script accepts a command only from the extension itself, never from another tab or the page, and the shared `isTabCommand` check allows only `play` and `pause`.
- Opening a different video in the playback tab replaces Now Playing (done in task 17, now covered by a browser test too). A tab that only loads a video, or is paused or buffering, changes nothing (unit and browser tests).
- Two windows: the browser test creates one with `chrome.windows.create`; its page is loaded again through the test route because the first request of an externally created window is not routed.
- ADRs 0005 and 0006 are Accepted as written (overlay on every tab, as now), with the tab-lost rules and discard fact added in task 16. The system design's open question on this is closed.
- Real YouTube (headless, signed out): A playing, then B playing in another tab → A paused (state 2) and still open, B the playback tab and Now Playing; then a third video in a second window → B paused, the playback tab's window id is the new window's.


### 19. Now Playing in the side panel

**Goal:** The side panel shows what is playing and lets the user pause, play and go to it from any tab.

**Implements:** PLY-036, PLY-051, PLY-055, PLY-056, PLY-057, PLY-115 (thumbnail, title, channel, play/pause, Go to video only), PLY-119 (in part); decisions n and r

**In scope:**

- A Now Playing card under the Audio only card, matching the prototype: thumbnail (from the video ID, decision n), title, channel, a play/pause button and Go to video
- "Nothing playing" when there is no Now Playing, as in the prototype's empty state
- `player/command` (play, pause, go to video) from the side panel to the background; the background passes play and pause to the playback tab, and for go to video brings that tab and its window to the front
- `sidepanel/core/` combines Now Playing and the playback tab's state into what the card shows; `sidepanel/ui/` only renders it
- If there is no playback tab, play/pause and Go to video are disabled (Resume arrives in task 20)

**Out of scope:**

- Progress, elapsed and remaining time, volume, Next, Previous, Live and Buffering labels, Up next, the panel mini-player, the Save control — sections 4.5 and 4.9

**Done when:**

- [x] The card shows the thumbnail, title and channel of Now Playing; a title containing markup shows as plain text
- [x] Pause and play from the side panel change YouTube's player within 1 second
- [x] Pausing on YouTube (overlay click, `K`) changes the side panel's button within 1 second
- [x] Go to video brings the playback tab and its window to the front
- [x] The card stays the same while the user switches tabs in the window (`PLY-055`)
- [x] "Nothing playing" shows on a fresh install
- [x] Usable from 320 to 600 px wide, keyboard operable, buttons labelled for screen readers
- [x] Logic tests cover `sidepanel/core/` without importing any `.svelte` file

**Notes:**

- `sidepanel/core/now-playing.ts` combines the stored Now Playing and the playback tab into one view (video with a thumbnail URL derived from its ID, playing or not, whether there is a tab to control); `sidepanel/ui/NowPlayingCard.svelte` only renders it. The card sits under the Audio only card, and the empty state is the prototype's "Nothing playing" with its wording shortened to what exists ("Open any YouTube video.").
- Thumbnails come from `i.ytimg.com` by video ID (decision n); the browser tests answer that host with a one-pixel image so they never depend on the network. The title and channel are rendered by Svelte as text; a title containing `<img onerror=…>` shows literally and runs nothing (browser test).
- Commands: the side panel sends `player/command` (`play`, `pause`, `go-to-video`, and `resume` for task 20) to the background. The background passes play and pause to the playback tab, and for `go-to-video` makes the tab active and focuses its window. The background accepts the command only from an extension page (its URL is under `chrome-extension://<id>/`), never from a YouTube tab; the first version checked "has no tab", which wrongly refused the panel when it was opened in a tab in the tests.
- With no playback tab (for example after a restart) the card still shows the stored video, with Play and Go to video disabled; Resume arrives in task 20.
- Real YouTube (headless, signed out): the card showed the real title, channel and a loaded thumbnail; Pause and Play from the panel changed YouTube's player state within a second, and pausing on YouTube flipped the panel button.
- Left out as planned: progress, volume, Next and Previous, Live and Buffering labels, Up next, the panel mini-player, the Save control.
- **Follow-up (button lag):** the user reported that play and pause themselves were immediate but the side panel's button took a few seconds to change. Causes found and fixed: (1) the page script read the play state from YouTube's player, which can trail the video element by a moment, so the first check after a pause saw no change and the report waited for the 1 second beat, which a hidden tab's throttled timer can stretch; the state is now read from the `<video>` element; (2) video events were listened for on the element found at the last beat, so a swapped element was missed until the next beat; they are now caught on the document in the capture phase; (3) the panel waited for the stored state before changing; the button now changes at once on a click and the real state replaces it (back after 4 seconds, or at once if the command fails); (4) a `pause` sent to the old playback tab was awaited inside the queue that applies every report, so a frozen tab could hold everything up; it is no longer awaited. On real YouTube, a pause or play on the page now shows in the button in 7 to 140 ms (it was up to about 1 second).

### 20. Playback tab lost, and Resume

**Goal:** When the playback tab goes away, the side panel keeps the video, paused at its position, and Resume starts it again in a new background tab.

**Implements:** PLY-049, PLY-050, PLY-052, PLY-053, PLY-054

**In scope:**

- Noticing the playback tab is lost: closed, moved off YouTube, crashed, discarded or unloaded (as the spike found)
- On loss: save the position, remove `playbackTab`, keep Now Playing; the side panel shows it paused with Resume
- Resume: open the video in a new tab at the saved position without taking focus, and start playing, as decided from the spike; it never navigates or closes another tab
- After a browser restart, Now Playing shows paused with Resume (there is no playback tab)
- The extension never closes or reloads a tab itself (`PLY-049`)

**Out of scope:**

- Starting playback when nothing has played yet (`PLY-041`) — decision o

**Done when:**

- [x] Closing the playback tab at 12:30 → the side panel shows the video paused at 12:30 with Resume
- [x] The same when the tab moves to another site
- [x] Resume opens a new tab without moving focus; the video plays from within about 2 seconds of 12:30 (or as decided from the spike)
- [x] After a browser restart, Now Playing shows paused with Resume, and nothing plays by itself
- [x] Manual check on real YouTube passes, including a discarded tab if the spike found a way to cause one

**Notes:**

- Loss (`background/playback.ts`): the playback tab is lost when it is closed (`tabs.onRemoved`), is discarded (`onUpdated` with `discarded`, and `onReplaced`, below), or is found gone, `unloaded` (a crash raises no event), discarded or **no longer on YouTube** when looked at. The look happens when the service worker starts, when the side panel asks (`player/command` `check`: an open panel asks when it opens and every 15 seconds), and 2.5 seconds after the tab starts a page load.
- **A page load alone does not mean lost.** The first version treated `onUpdated` `status: 'loading'` as lost; that also fires for YouTube's own in-page moves (`history.pushState`), which made every move to another video drop the playback tab. The browser test for task 18 caught it. The tab is now looked at after the load: a tab with no URL (the extension has no access to other sites) or a non-YouTube URL is lost; a YouTube URL keeps the role. Consequence for task 21: a tab that reloads YouTube stays the playback tab and reports again.
- **A discard gives the tab a new ID** (`tabs.onReplaced(new, old)`, and the discarded event arrives for the new ID), found with a spike script after the first tests failed; the old ID never fires. The background now treats `onReplaced` of the playback tab as lost.
- On loss the background removes `playbackTab` (and the tab's video note) and keeps Now Playing, with the position saved by the last report (never more than about 5 seconds old). It never closes, reloads or navigates a tab (`PLY-049`).
- Panel: with a video and no playback tab the card shows "Paused at m:ss" and a Resume button in place of play and pause; Go to video is disabled.
- Resume (decision from the spike): `chrome.tabs.create({ url: watch?v=ID&t=<position>s, active: false })`, then the new tab is recorded at once as the playback tab, state `paused`, not discardable, with a `resume` mark in session storage. The tab's own page loading is not taken for a loss for 20 seconds after Resume. The mark clears when the tab reports `playing`. If it has not started after 10 seconds the card says "Waiting to start. Show the tab to begin playback." and Play and Go to video work on it. A first `paused` report at position 0 from the loading page does not overwrite the saved position.
- After a browser restart there is no playback tab (session storage), Now Playing is read from local storage and shown paused with Resume; nothing opens or plays by itself (browser test).
- Real YouTube (headless, signed out): closing the playing tab showed "Paused at 5:06" with Resume; Resume opened `watch?v=…&t=306s` in a background tab, it played at 307 within about 1.5 seconds, and the active tab did not change. The tab moved to another site and the discard were covered by browser tests on the test page, as was the crash path by unit test (a real crash could not be driven without hanging the harness).
- Not verified: how a truly hidden tab in a normal Chrome behaves (see the spike's manual checks), and a discard under real memory pressure.


### 21. Moving around in the playback tab

**Goal:** Leaving the video page in the playback tab keeps the audio going in YouTube's mini-player, covered by the overlay, and Now Playing stays the same.

**Implements:** PLY-044, PLY-045; decision k

**In scope:**

- Following what the spike found: when the user moves from a watch page to another YouTube page in the playback tab, Now Playing and the playback tab stay, and the mini-player stays covered (built in task 13)
- A full page load that ends the video counts as the tab being lost (task 20)
- If YouTube does not keep playing, do what was decided in "Decide before the task that needs it"

**Out of scope:**

- Loading the next video into the mini-player (`PLY-043`) — decision o

**Done when:**

- [x] On the test page: playing, then an in-page move to the home page → still the playback tab, same Now Playing, still playing, mini-player covered
- [x] Opening another video in the same tab replaces Now Playing
- [x] Manual check on real YouTube passes

**Notes:**

- What the spike and a second look on real YouTube showed: leaving a watch page by a normal link (logo, search) **stops the video** (state 5, player 0 × 0), and a stopped hidden player cannot be started again from there (`loadVideoById` left it at state -1). The mini-player appears only when the user asks for it, and then the same player element moves into it and keeps playing.
- So the extension follows the user's own choice. In the mini-player (opened with `I` or the button): the playback tab, Now Playing and the sound stay, and the mini-player stays covered (task 13). Without it: the page script sees the main player missing for 1.5 seconds and reports `player/gone` with the last position (never an ad's); the background saves it, forgets the playback tab and keeps Now Playing, so the side panel shows it paused with Resume (task 20). The gap before it counts is there because the mini-player opens with a moment where the player is 0 × 0.
- This is how `PLY-044` is met and where it is not: audio keeps playing in the mini-player **only if the user opens it**; the extension does not try to force it (the one try, asking for it on `yt-navigate-start`, did nothing). Worth recording against the requirement.
- Opening another video in the same tab replaces Now Playing and the tab stays the playback tab, also after the look that follows a page load (covered by browser tests, because YouTube's own in-page moves raise a "loading" update; see task 20's notes).
- A reload of the YouTube page keeps the tab as the playback tab; it reports again and the state goes to paused while it loads.
- Test page: the fake player keeps its video when the URL leaves the watch page, as YouTube's does. Browser tests: mini-player move (same tab, same Now Playing, still playing, still covered), leaving with no mini-player (tab forgotten, position kept), another video, and a reload.
- Real YouTube (headless, signed out): `I` key → tab, Now Playing and playing state kept, overlay inside the mini-player; another video via `loadVideoById` replaced Now Playing; leaving by the logo link → playback tab gone within the wait, Now Playing kept, panel showing "Paused at 4:18" with Resume.

