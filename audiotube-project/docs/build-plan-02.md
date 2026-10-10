# AudioTube — Build Plan, Phase 2

| | |
|---|---|
| **Status** | Draft |
| **Last updated** | 2026-10-10 |
| **Design** | [Requirements](audiotube_requirements.md), [Tech stack](tech-stack.md) |
| **Phase 1** | [build-plan-01.md](build-plan-01.md): audio-only mode, tasks 1 to 7 |

Each task is a thin slice that works end to end, small enough for one coding session. Don't rewrite tasks that are done; add a new task for follow-up work.

The side panel is built to match the prototype, `extension/_prototype/`: its look, layout, states and wording. The requirements decide scope and rules. The prototype is a reference only and is never shipped.

**Phase 2 — The rest of the overlay** (section 4.2, PLY-013 to PLY-021): tasks 8 to 14. Task 8 first fixes what the review of phase 1 found. Phase 1's decisions a to i still apply unless a decision below replaces one. Sections 4.3 to 7 are not started.

## Decide before the task that needs it

| Decision | Needed by |
|---|---|
| Which tab the "Couldn't cover YouTube's player" message is about, since every YouTube tab gets an overlay (decision c). Suggested: the active tab in the side panel's own window | Task 14 |
| What Space and Enter do while the Show video button has keyboard focus. Suggested: they press the button (needed to reach it by keyboard); a mouse click on the overlay never leaves focus on the button, so YouTube's shortcuts keep working | Task 12 |

## Decisions for phase 2

These apply to this phase only and do not change the requirements document.

| # | Decision | Revisit |
|---|---|---|
| j | Decision c still holds: every YouTube tab gets the overlay. Phase 2 does not add the playback tab. | Section 4.4 |
| k | The overlay covers YouTube's mini-player whenever YouTube shows it (PLY-014). Keeping audio playing in the mini-player when leaving a video page (PLY-043, PLY-044) is not part of this phase. | Section 4.4 |
| l | Requests that act on YouTube's player (play and pause for PLY-018) go through the page script, as the quality requests do. | Architecture doc |

## Tasks

| # | Task | Requirements | Depends on | Status |
|---|---|---|---|---|
| 8 | Fixes from the phase 1 review | GLB-009, decision f | 7 | Done |
| 9 | Overlay stays in place: theater, fullscreen, resize, error screen | PLY-013, PLY-020 | 8 | Done |
| 10 | No flash on load, no ambient glow | PLY-015, PLY-017 | 8 | Done |
| 11 | Picture-in-picture off while audio-only is on | PLY-016 | 8 | Done |
| 12 | Click to pause, and YouTube's shortcuts keep working | PLY-018, PLY-019 | 8 | Done |
| 13 | Overlay on YouTube's mini-player | PLY-014, PLY-022 | 9 | In progress |
| 14 | "Couldn't cover YouTube's player" message | PLY-021 | 8 | To do |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

Task 8 comes first; tasks 9 to 12 and 14 can then be done in any order, and task 13 follows task 9. Task 8 depends on task 7 in [build-plan-01.md](build-plan-01.md).

## Task details

### 8. Fixes from the phase 1 review

**Goal:** Close the gaps the review of tasks 1 to 7 found, before more is built on top.

**Implements:** GLB-009, decision f

**In scope:**

- **Leftover copies after an update.** When the extension is updated or reloaded, Chrome keeps the old copy of the content script running in open tabs, cut off from the extension. Its overlay and control-bar button stay on the page and stop reacting, so turning audio-only off would leave the video covered, and its Show video button would do nothing. Fix both sides:
  - the old copy notices it has been cut off (for example `chrome.runtime.id` is gone, or a request fails with `background-unavailable`) and removes its overlay, button and observers;
  - the new copy removes any overlay or button it did not create when it starts.
- **Show video failing silently.** If the request to turn audio-only off fails, the overlay stays (correct) but nothing tells the user. Show a short line on the overlay, for example "Couldn't change the setting. Try again." (GLB-009). Same for the control-bar button.
- **Doc drift:**
  - `CLAUDE.md` lists `docs/architecture.md` as if it exists; mark it "(not yet written)" again.
  - `CLAUDE.md`'s tech-stack table and Tests section still say the test tools are not decided; say Vitest and Playwright.
  - `CLAUDE.md`'s folder tree shows `public/manifest.json`; it is `manifest.config.ts`.
  - `tech-stack.md`: record the chosen plugin (`@crxjs/vite-plugin`) and test tools.
  - `README.md`: point the logo at `extension/_prototype/AudioTube.png` and remove the stray "ude" at the end.
- If CI shows the browser tests that call into the service worker failing with "`chrome.runtime` / `chrome.storage` is undefined", make those tests wait until the worker's extension APIs are ready. (They failed this way in a review run on Chromium 141; they may pass on the CI's Chromium.)

**Out of scope:**

- Any new feature

**Done when:**

- [x] Manual check: load the build, open a YouTube watch page, reload the extension from `chrome://extensions` → exactly one overlay; turning audio-only off from the side panel removes it; Show video works
- [x] With the background unreachable (in a test), pressing Show video keeps the overlay and shows the message
- [x] The doc fixes above are made
- [x] CI has run green once (also tick task 1's CI check in [build-plan-01.md](build-plan-01.md) and move task 1 to Done there)

**Notes:**

- Leftover copies: a new copy of the content script removes every `audiotube-overlay` and `audiotube-control` element when it starts. An old copy checks `chrome.runtime.id` once a second, and after a failed request, and shuts down its overlay, button, quality controller and observers when the id is gone. The page script now stops any earlier copy of itself first, so the newest copy is the only one.
- Tests: a page with stale elements ends with exactly one overlay; reloading the extension from the service worker takes the overlay away within 5 seconds. The "reload from `chrome://extensions`" manual check is covered by these two, not done by hand.
- Show video and the control bar button show "Couldn't change the setting. Try again." for 6 seconds when the request fails; the test breaks the background's write to cause it. A request that fails because the extension is gone shuts the copy down instead.
- Browser tests that talk to the service worker now go through `getWorker`, which waits for `chrome.runtime` and `chrome.storage` to exist in the worker. CI was already green; this is a guard for the slower Chromium builds the review hit.
- Docs: `CLAUDE.md` (architecture "not yet written", Vitest and Playwright, `manifest.config.ts`, build plan row now names the phase files), `tech-stack.md` (plugin, tests, stray "ude" removed from its first line, not README's), `README.md` logo path. Phase 2's link to phase 1 now points at `build-plan-01.md`.
- CI: green on 2026-10-10 (run for `b36ca72`); task 1 is already Done in `build-plan-01.md`.


### 9. Overlay stays in place: theater, fullscreen, resize, error screen

**Goal:** The overlay keeps covering the whole player in every layout YouTube offers, and when YouTube shows an error screen.

**Implements:** PLY-013, PLY-020

**In scope:**

- Checking the overlay in theater mode, fullscreen and while the window is resized, and fixing what doesn't hold
- Checking it stays above YouTube's error screen ("Video unavailable" and similar) and fixing it if not
- Test page additions that copy what YouTube does in each case (the theater class, the fullscreen element, the error screen element)

**Out of scope:**

- The mini-player — task 13

**Done when:**

- [x] On the test page, the overlay matches the player's size in normal, theater and fullscreen layouts and after a resize
- [x] On the test page, the overlay stays on top of the error screen
- [x] Manual check on real YouTube passes: theater, fullscreen (button and `F` key), resize, an unavailable video

**Notes:**

- Nothing needed fixing: the overlay is a child of `#movie_player`, sized `inset: 0`, and its `z-index` (100000) is far above YouTube's error element (44), so it follows the player into theater and fullscreen and stays above the error screen.
- The test page gained a theater toggle, a fullscreen button (which fullscreens `#movie_player`, as YouTube does), a resizable player, and an error element with YouTube's `ytp-error` class and z-index. Five browser tests cover them.
- Real YouTube, headless Chromium, signed out: theater (`T` key), a resize to 900 px, fullscreen and back (`F` key) all left the overlay exactly the player's size and on top of the controls. Fullscreen was checked through the `F` key only; the fullscreen button goes through the same player code. A bad video id shows a page-level "Video unavailable" with no player at all (nothing to cover); the in-player error element was simulated on a real page and the overlay stayed on top of it. A real in-player error (a private or region-blocked video) was not found in this environment.


### 10. No flash on load, no ambient glow

**Goal:** While audio-only is on, the picture is never visible, not even for a moment while a page loads or the video changes, and YouTube's ambient glow never shows around the player.

**Implements:** PLY-015, PLY-017

**In scope:**

- CSS that hides the picture and the ambient glow, in place before the page is drawn. Reading the saved value is too slow for that, so one way is for the background to register a CSS-only content script at `document_start` while audio-only is on (`chrome.scripting.registerContentScripts`) and remove it when it turns off.
- The overlay hides the ambient glow while it is present, and the glow returns when audio-only turns off

**Out of scope:**

- Hiding anything outside the player area

**Done when:**

- [x] On the test page, with audio-only on, the video element is never visible from the first paint until the overlay is in place, on load and on an in-page move
- [x] On the test page, the ambient glow element is hidden while audio-only is on and shown again when it turns off
- [x] With audio-only off, the early CSS is not added to new pages
- [x] Manual check on real YouTube passes: reload a watch page and move between videos with audio-only on, no picture or glow visible

**Notes:** The early CSS stays in a page once Chrome has added it. Make sure turning audio-only off in an already-open page still shows the picture (for example, key the CSS on an attribute the content script removes).

**Notes:**

- The background registers `early.css` as a CSS-only content script at `document_start` while audio-only is on and removes it when it turns off (`background/early-css.ts`). It follows the saved value at service worker start and on every change, one change after another. Registered scripts persist across browser sessions.
- The CSS hides `#movie_player`'s video, video container, cued thumbnail and storyboard preview, and `#cinematics`, unless `<html>` carries `data-audiotube-visible`. The content script sets that attribute while audio-only is off (`content/visibility.ts`), so an open page shows the picture again at once. A page that finds the attribute absent before the script has read the saved value stays hidden, which is the safe side.
- The overlay also hides `#cinematics` itself with a stylesheet it adds to the document while it is present, so the glow is hidden even on a page opened before the early CSS was registered.
- Test: a frame-by-frame recorder on the test page finds no frame with the picture visible and no overlay, on load and on an in-page move. As a control, with the early CSS unregistered the same recorder sees 2 such frames on load.
- Real YouTube: 0 such frames on first load, reload and an in-page move; turning audio-only off shows the picture. The ambient glow could not be seen in this environment: YouTube's `#cinematics` is already `display: none` for a signed-out headless profile with or without the extension, so the hide rule was only verified on the test page.


### 11. Picture-in-picture off while audio-only is on

**Goal:** The browser's picture-in-picture view can't show the video while audio-only is on.

**Implements:** PLY-016

**In scope:**

- Turning picture-in-picture off on the video element while audio-only is on, and back on when it turns off
- Closing an open picture-in-picture window when audio-only turns on

**Out of scope:**

- Picture-in-picture while audio-only is on (FS-017)

**Done when:**

- [x] On the test page, picture-in-picture can't be started while audio-only is on, and can again after it turns off
- [x] On the test page, an open picture-in-picture window closes when audio-only turns on
- [x] Manual check on real YouTube passes, including the right-click menu and YouTube's own button

**Notes:**

- `content/pip-controller.ts` sets `disablePictureInPicture` on every video inside the player while audio-only is on (remembering what each had), puts it back when off, and calls `document.exitPictureInPicture()` when audio-only turns on. A second observer watches the attribute, so a video whose attribute YouTube switches back is put right again, and new videos after an in-page move are covered by the page-change observer.
- It only assigns when the value differs. Assigning the same value still raises a change record, which with the attribute observer made the first version loop and hang the page; the browser tests caught it.
- The test page can give its video a real picture (a canvas stream), so picture-in-picture is really started or refused in Chromium. Three browser tests cover refusal while on, starting after off, closing an open window, and a re-enabled or new video.
- Real YouTube (headless, signed out): while on, the video has the attribute set, `requestPictureInPicture()` is refused with `InvalidStateError`, and YouTube's own PiP button does nothing; after turning audio-only off it works again. The browser's right-click menu entry is Chrome's own UI and was not exercised; it follows the same attribute.


### 12. Click to pause, and YouTube's shortcuts keep working

**Goal:** Clicking the overlay pauses or resumes the video, as clicking YouTube's video does, and YouTube's keyboard shortcuts keep working with the overlay in place.

**Implements:** PLY-018, PLY-019; decision l

**In scope:**

- A click on the overlay, outside the Show video button, toggles play and pause through the page script (new typed page messages)
- The overlay never keeps keyboard focus after a mouse click, so space, K, the arrow keys and M reach YouTube
- Space and Enter on the Show video button follow the decision in "Decide before the task that needs it"

**Out of scope:**

- Showing play or pause state in the side panel (section 4.5)

**Done when:**

- [x] On the test page, clicking the overlay pauses a playing video and plays a paused one; clicking Show video does neither
- [x] On the test page, after clicking the overlay, pressing space, K, the arrow keys and M reach the page's own key handler
- [x] Manual check on real YouTube passes

**Notes:**

- A click on the cover sends a new typed message, `player/toggle-playback`, to the page script (decision l). The page script uses the player's own `getPlayerState` (playing or buffering → `pauseVideo`, anything else → `playVideo`) and falls back to the `<video>` element if the player methods are missing. The click stops there, so YouTube's own click handler does not also toggle (checked on real YouTube: one click, one change).
- Focus: a mouse press on the overlay is cancelled at `mousedown`, so focus never moves onto the overlay, and a mouse click on Show video blurs the button. Keyboard focus still reaches Show video by Tab, and Space or Enter then press it, as suggested in the decision list.
- Real YouTube (headless, signed out): clicking the overlay paused, then played; `K` paused and played; the right arrow seeked 5 seconds; `M` muted. All with the overlay in place.
- The test page's player now has `getPlayerState`, `playVideo` and `pauseVideo` over a real streaming video, and records key presses, so the tests check the real effects.


### 13. Overlay on YouTube's mini-player

**Goal:** While audio-only is on, YouTube's own mini-player is covered too, on any YouTube page.

**Implements:** PLY-014, PLY-022; decision k

**In scope:**

- Finding YouTube's mini-player on any `www.youtube.com` page, and covering it while audio-only is on
- A compact version of the cover that fits the mini-player's size (for example logo and Show video, without the label)
- Removing the overlay when the mini-player closes or expands back to the watch page
- Test page additions that copy the mini-player's structure, checked first against real YouTube

**Out of scope:**

- Keeping audio playing in the mini-player when leaving a video page (PLY-043, PLY-044; decision k)

**Done when:**

- [ ] On the test page, the mini-player is covered while audio-only is on and uncovered when it turns off
- [ ] On the test page, the overlay follows the mini-player when it closes and when it expands back
- [ ] Manual check on real YouTube passes: open a video, go to the home page so the mini-player appears, check it is covered; expand it back

### 14. "Couldn't cover YouTube's player" message

**Goal:** If the overlay can't be applied on a watch page, the side panel says so, and audio keeps playing.

**Implements:** PLY-021

**In scope:**

- The content script reports when it is on a watch page with audio-only on but can't find the player after a short wait (suggested: 5 seconds), and when it later can
- A typed message to the background, which keeps the latest status for each tab in `chrome.storage.session` (the service worker can restart at any time)
- The side panel shows "Couldn't cover YouTube's player on this page" for the tab chosen in "Decide before the task that needs it", and removes it once the overlay is in place or the tab closes
- Nothing pauses or stops playback because of it

**Out of scope:**

- Other Player tab states (PLY-120)

**Done when:**

- [ ] On a test page with no player element, the side panel shows the message within about 6 seconds and audio-only stays on
- [ ] When the player appears later, the message goes
- [ ] Closing the tab clears its status
- [ ] Logic tests cover the status handling in the background and `sidepanel/core/`
