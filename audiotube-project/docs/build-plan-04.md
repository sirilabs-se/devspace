# AudioTube — Build Plan, Phase 4

| | |
|---|---|
| **Status** | Draft |
| **Last updated** | 2026-10-11 |
| **Design** | [Requirements](audiotube_requirements.md), [System design](architecture.md), [Decisions](architecture/decisions/README.md), [Stored data](architecture/storage.dbml) |
| **Earlier phases** | [build-plan-01.md](build-plan-01.md): audio-only mode, tasks 1 to 7 · [build-plan-02.md](build-plan-02.md): the rest of the overlay, tasks 8 to 14 · [build-plan-03.md](build-plan-03.md): where audio plays from, tasks 15 to 21 |

Each task is a thin slice that works end to end, small enough for one coding session. Don't rewrite tasks that are done; add a new task for follow-up work.

The side panel is built to match the prototype, `extension/_prototype/`: its look, layout, states and wording. The requirements decide scope and rules. The prototype is a reference only and is never shipped.

**Phase 4 — Playback controls** (section 4.5 without the parts that need the Queue, and remembering the volume from 4.10): tasks 22 to 25. Task 22 first closes what the review of phase 3 found. Earlier decisions a to r still apply unless a decision below replaces one. **Nothing from section 4.7 (ads) is built in this phase**; it is being reviewed.

## Decide before the task that needs it

| Decision | Needed by |
|---|---|
| Accept [ADR 0007](architecture/decisions/0007-side-panel-counts-progress-forward.md): the side panel counts the position forward between reports, instead of a report every second. Suggested: accept | Task 23 |
| Whose volume wins when a tab becomes the playback tab: the volume the extension remembered, or the one YouTube's player has in that tab. Suggested: the remembered one, so the volume is the same from one video and tab to the next (`PLY-063`); after that, a change on either side updates both | Task 25 |

## Decisions for phase 4

These apply to this phase only and do not change the requirements document.

| # | Decision | Revisit |
|---|---|---|
| s | Nothing from section 4.7 is built: no ad detection beyond what exists, no "Ad playing" state, no ad time display. The one ad rule that applies everywhere, `GLB-005`, is kept: the page script ignores a seek while an ad is showing, so a seek can never skip one. The page script already never reports ad time as the position | Section 4.7, after the requirements review |
| t | Previous, Next, Loop and Shuffle are not built; they need the Queue. The controls row has play/pause only, where the prototype has more | Section 5 |
| u | The panel mini-player (`PLY-121` to `PLY-126`) waits for the Queue phase. It shows only when the Player tab is not open, and the side panel has no other tabs yet | Section 5 |
| v | The playback speed option (`PLY-073`, `PLY-074`) is not built, but the page script reports the player's rate, because counting the position forward needs it (ADR 0007) | Section 4.6 |

## Tasks

| # | Task | Requirements | Depends on | Status |
|---|---|---|---|---|
| 22 | Fixes from the phase 3 review | GLB-012, PLY-053 | 21 | Done |
| 23 | Progress, elapsed and remaining time | PLY-059, PLY-064, PLY-067; ADR 0007 | 22 | In progress |
| 24 | Seeking from the side panel | PLY-060, PLY-065, GLB-005 | 23 | To do |
| 25 | Volume and mute | PLY-061, PLY-062, PLY-063, PLY-131 (volume) | 22 | To do |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

Task 22 comes first. Task 24 follows task 23; task 25 can be done before or after them. Task 21 is in [build-plan-03.md](build-plan-03.md).

## Task details

### 22. Fixes from the phase 3 review

**Goal:** Close what the review of tasks 15 to 21 found, so the docs the coding agent reads match the code.

**Implements:** GLB-012, PLY-053

**In scope:**

- **`CLAUDE.md`:**
  - the design-docs table lists `build-plan-03.md` and `build-plan-04.md`, the decision log (`docs/architecture/decisions/README.md`) and the stored-data schema (`docs/architecture/storage.dbml`)
  - the tech-stack table's storage row says `chrome.storage.local` and `chrome.storage.session`
  - the storage rule and the folder tree speak of the storage read helpers in `shared/storage/`, not "the settings read helper"
  - the local-only rules: drop "the custom cover image" (it is Future Scope, `FS-007`); "Nothing … MUST be sent" becomes "MUST NOT be sent"; say that the only requests the extension makes itself are YouTube thumbnails (decision n)
- **Resume of a live stream** opens `watch?v=ID` without `&t=…`, since a live stream has no position to return to
- **Manual checks:** add to `docs/spikes/playback-tab.md` the results of the checks done by hand in a normal Chrome (the owner does them; see "Done when")

**Out of scope:**

- Any new feature

**Done when:**

- [x] `CLAUDE.md` changes above are made
- [x] Resuming a live stream opens it without `&t=` (unit test)
- [x] The manual check results are recorded, as far as they have been done: a Resume tab opened in the background really starts playing in a normal Chrome; disabling the extension with audio-only on leaves the video visible; discarding the playback tab in `chrome://discards` shows Resume; whether YouTube's mini-player appears by itself when signed in

**Notes:**

- `CLAUDE.md`: the design-docs table lists build plans 01 to 04, the decision log and `storage.dbml`; the storage row says local and session; the rules and the folder tree speak of the storage read helpers in `shared/storage/`; the local-only rules drop the cover image, say "MUST NOT be sent" (worded as "Anything about what the user listens to MUST NOT be sent off the device") and state that the only requests the extension makes itself are YouTube thumbnails.
- Resuming a live stream opens `watch?v=ID` with no `&t=` (unit test).
- Manual checks: I cannot run a normal, headed Chrome with a signed-in account from here, so the results table in `docs/spikes/playback-tab.md` is in place with the four checks and how to do each, marked "not yet done" for you to fill in. The third "Done when" item is ticked as "recorded as far as done", which today is: nothing has been done by hand yet.
- The updated design docs you added (`architecture.md`, `architecture/decisions/0007-…`, `storage.dbml`, `build-plan-04.md`) are committed with this task.


### 23. Progress, elapsed and remaining time

**Goal:** The Now Playing card shows how far the video has played and how much is left, moving every second while it plays.

**Implements:** PLY-059, PLY-064, PLY-067; [ADR 0007](architecture/decisions/0007-side-panel-counts-progress-forward.md); decisions s and v

**In scope:**

- The page script adds the playback rate to `player/state`, and also sends `player/state` after a seek and a rate change made on YouTube
- The background writes the state, position, rate and time into `playbackTab` in one write
- `sidepanel/core/` counts the position forward while playing, kept between 0 and the duration, and redraws every second; `sidepanel/ui/` shows a progress bar with elapsed and remaining time, styled like the prototype's
- A live stream shows a "Live" label and no duration or remaining time (`PLY-064`)
- While buffering, the card shows "Buffering" and the bar stops (`PLY-067`)
- With no playback tab (paused with Resume), the bar shows the saved position and does not move

**Out of scope:**

- Seeking — task 24
- "Ad playing" in place of the bar — section 4.7 (decision s)

**Done when:**

- [ ] On the test page, while playing, elapsed time goes up by one each second and the bar moves; on pause, both stop within 1 second
- [ ] A seek made on the page (arrow key) shows in the panel within 1 second
- [ ] At double speed set on the page, elapsed time goes up by two each second
- [ ] The count never goes past the duration, and the remaining time never below 0:00
- [ ] A live stream shows "Live" and no times; buffering shows "Buffering"
- [ ] With the YouTube tab in the background, the bar still moves every second
- [ ] Logic tests cover the counting (playing, paused, buffering, rate, clamping, live) without importing any `.svelte` file

### 24. Seeking from the side panel

**Goal:** The user can move to any point in the video from the side panel.

**Implements:** PLY-060, PLY-065, GLB-005; decision s

**In scope:**

- Clicking or dragging the progress bar seeks; while dragging, the elapsed time follows the drag and the seek is sent on release
- With the bar focused, the left and right arrow keys move 5 seconds back or forward (`PLY-060`)
- `player/command` `seek` from the side panel to the background, then to the playback tab's page script, which seeks the player
- The page script ignores a seek while `#movie_player` has the class `ad-showing` (`GLB-005`)
- Seeking never changes what is Now Playing; the saved position is updated by the report that follows
- Seeking is disabled for a live stream (`PLY-065`) and when there is no playback tab

**Out of scope:**

- Showing why seeking is unavailable during an ad — section 4.7

**Done when:**

- [ ] On the test page, clicking the bar at its middle moves the player to about half the duration, and the panel shows it within 1 second
- [ ] Dragging and releasing seeks once, to where the drag ended
- [ ] With the bar focused, the right arrow moves 5 seconds forward, the left arrow 5 seconds back
- [ ] On the test page with the `ad-showing` class on the player, a seek from the panel changes nothing
- [ ] The bar can't be used for a live stream or without a playback tab
- [ ] The bar is reachable by keyboard and announced as a slider with its value as a time

### 25. Volume and mute

**Goal:** The side panel controls YouTube's volume and mute, stays in step with changes made on YouTube, and remembers the volume across sessions.

**Implements:** PLY-061, PLY-062, PLY-063, PLY-131 (volume)

**In scope:**

- A volume slider (0 to 100) and a mute button in the Now Playing card, like the prototype's
- Saved value `volume` (`level`, `muted`) in local storage, written only by the background; absent until first known
- The page script reports the main player's volume and mute when they change (`player/volume`); the background stores the playback tab's, and ignores other tabs'
- `player/command` `set-volume` from the side panel to the background, which stores it and passes it to the playback tab
- When a tab becomes the playback tab (take-over or Resume), the volume is set as decided in "Decide before the task that needs it"
- With no playback tab, the controls still change the remembered volume, used by the next playback tab

**Out of scope:**

- Ads' own volume rules beyond what the player does (`PLY-100`) — section 4.7

**Done when:**

- [ ] Moving the slider changes YouTube's volume on the test page within 1 second; the mute button mutes and unmutes
- [ ] Changing the volume or muting on the page moves the side panel's controls within 1 second
- [ ] After a browser restart, the side panel shows the remembered volume, and the next playback tab gets it
- [ ] A volume change in a YouTube tab that is not the playback tab changes nothing
- [ ] Controls are keyboard operable and labelled for screen readers; usable from 320 to 600 px wide
- [ ] Logic tests cover the background's volume handling and `sidepanel/core/`
