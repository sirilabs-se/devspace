# AudioTube — Build Plan

| | |
|---|---|
| **Status** | Draft |
| **Last updated** | 2026-10-10 |
| **Design** | [Requirements](audiotube_requirements.md), [Tech stack](tech-stack.md) |

Each task is a thin slice that works end to end, small enough for one coding session. Don't rewrite tasks that are done; add a new task for follow-up work.

The side panel is built to match the prototype, `extension/_prototype/`: its look, layout, states and wording. The requirements decide scope and rules. The prototype is a reference only and is never shipped.

**Current phase: Audio-only mode (requirements section 4.1, PLY-001 to PLY-008).** Sections 4.2 to 7 are not started, apart from the small parts of 4.2 that 4.1 cannot work without (see decision a).

## Decide before the first task starts

- [ ] Vite plugin for the extension build (suggested: `@crxjs/vite-plugin`)
- [ ] Where the npm project lives (suggested: `audiotube-project/extension/`, with `_prototype/` left out of the build)
- [ ] Test tools (suggested: Vitest for logic, Playwright with the extension loaded for browser tests)
- [ ] Import-rule checker (suggested: `dependency-cruiser`, as in saas-project)

## Decisions for this phase

These apply to this phase only. They do not change the requirements document, which stays the target for v1. Revisit each one when the phase named in "Revisit" begins.

| # | Decision | Revisit |
|---|---|---|
| a | The overlay comes from section 4.2, but PLY-006 cannot work without it. This phase builds only the basics: it covers the whole player (PLY-009), shows the plain cover and a Show video button (PLY-010, PLY-141), Show video turns audio-only off (PLY-011), it sits inside the player element (PLY-012), and it is present exactly when audio-only is on and a player is present (PLY-022). The rest of 4.2 comes later. | Section 4.2 |
| b | The Settings option named in PLY-001 is not built. The value is changed from the side panel switch and the overlay's Show video button only. | Section 7 |
| c | The overlay applies to every YouTube tab showing a watch page. There is no playback tab yet. | Section 4.4 |
| d | `saveBandwidth` is stored with its default (on), but has no switch yet. | Section 7 |
| e | "Previous quality" in PLY-008 means the quality in use just before audio-only turned on, falling back to YouTube's Auto. While audio-only is on, the lowest quality is requested again for each new video. | Task 5 findings |
| f | The extension adds its scripts to YouTube tabs that are already open when it is installed or updated, so they work without a reload. | — |
| g | Only `www.youtube.com` is supported. | Later phases |
| h | The control-bar button (PLY-007) is built last. If it proves unreliable, it is left out of the first release. | Task 7 |
| i | Only the background service worker writes saved values. The side panel and the YouTube page send it requests, and react to storage changes. | Architecture doc |

## Tasks

| # | Task | Requirements | Depends on | Status |
|---|---|---|---|---|
| 1 | Project setup | — | — | In progress |
| 2 | Saved audio-only value | PLY-001–003 | 1 | Done |
| 3 | Side panel switch | PLY-004, PLY-005 | 2 | Done |
| 4 | Overlay on YouTube | PLY-005, PLY-006 (+ 4.2 basics) | 2 | Done |
| 5 | Spike: requesting the lowest quality | PLY-008, OQ-001 | 1 | Done |
| 6 | Save bandwidth | PLY-008 | 4, 5 | Done |
| 7 | Audio only button in YouTube's control bar | PLY-007 | 4 | Done |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

Task 5 can run at any point after task 1, in parallel with tasks 2 to 4.

## Task details

### 1. Project setup

**Goal:** An empty extension builds, loads in Chrome and opens an empty side panel, with every automated check in place, so every later task is built and verified the same way.

**Implements:** [Tech stack](tech-stack.md), the rules in `CLAUDE.md`

**In scope:**

- The npm project, with Vite, the chosen extension plugin, Svelte 5, TypeScript and Tailwind CSS
- Folder structure from `CLAUDE.md`: `background/`, `content/`, `inject/`, `sidepanel/core/`, `sidepanel/ui/` (with `theme.css`), `shared/`
- Manifest V3: name, description, version, minimum Chrome version 116, permissions `storage`, `sidePanel` and `scripting`, host access to `https://www.youtube.com/*`, the side panel opening when the toolbar icon is clicked
- Icons at their real sizes (16, 48 and 128 px; the prototype's are all 50 × 50)
- Tailwind's theme built only from the tokens in `theme.css`, so no default Tailwind colours or sizes can be used
- ESLint, Prettier, `svelte-check`, Vitest and Playwright
- Import rules: modules imported only through `index.ts`, no import loops, `sidepanel/core/` never importing `sidepanel/ui/` or `.svelte` files, UI libraries only inside `sidepanel/ui/`, logic tests never importing `.svelte` files or `sidepanel/ui/`
- Style rule: no hard-coded colours, fonts or sizes outside `theme.css`
- One command, `npm run verify`, that runs lint, type checks, the import rules and all tests
- CI in `devspace/.github/workflows/audiotube-project.yml`, running `npm run verify` on every push that touches `audiotube-project/`
- Git hooks: an npm `prepare` script that runs `git config core.hooksPath .githooks`
- A `.gitignore` covering `node_modules` and build output

**Out of scope:**

- Any feature

**Done when:**

- [x] `npm run build` produces an extension that loads from `chrome://extensions` with no errors
- [x] Clicking the toolbar icon opens an empty side panel
- [ ] `npm run verify` passes locally and in CI
- [x] `npm run verify` fails when a rule is broken on purpose, e.g. importing a module's internal file or hard-coding a colour (then undo the break)
- [x] A commit message containing AI attribution is rejected by the hook
- [x] The build output contains nothing from `_prototype/`

**Notes:**

- Not ticked: CI. The workflow is in `devspace/.github/workflows/audiotube-project.yml` but has not run yet (nothing is pushed); tick it after the first green run.
- Loading in Chrome and the toolbar click are covered by Playwright against a headless Chromium: the extension loads with no console errors and the service worker sets `openPanelOnActionClick`. A real click on the toolbar icon is worth one manual check.
- `.githooks/commit-msg` already existed at the repo root (shared with saas-project), so no new hook was added. The `prepare` script points `core.hooksPath` at it.
- The manifest is `manifest.config.ts` (typed, via `defineManifest`) instead of `public/manifest.json` as CLAUDE.md's proposed tree shows.
- `npm audit` reports 5 high findings, all through `stylelint`'s dev-only dependency chain (`braces`), the same as saas-project. Nothing from it is shipped. The suggested fix downgrades stylelint to v7, so it was not applied.
- Icons were resized from the 2000 px `_prototype/AT.png`.
- Work noticed, left for later: `extension/_prototype/AudioTube.png` is what README.md's logo should point to.
### 2. Saved audio-only value

**Goal:** The extension has one saved audio-only value, on by default, that survives browser restarts and can be changed by request.

**Implements:** PLY-001, PLY-002, PLY-003, GLB-009, GLB-010; decisions d and i

**In scope:**

- Saved values `audioOnly` and `saveBandwidth` in `chrome.storage.local`. A missing or invalid value reads as its default (on).
- A typed message to the background asking it to set audio-only on or off
- The background writes the new value and replies with success or a typed error
- A failed write leaves the saved value unchanged and reports the error
- A small read helper the side panel and content script use, returning the value with defaults applied, and telling them when it changes

**Out of scope:**

- Any UI — tasks 3 and 4
- A switch for `saveBandwidth` — decision d

**Done when:**

- [x] On a fresh install, audio-only reads as on
- [x] After setting it off and restarting the browser, it still reads as off
- [x] An invalid saved value reads as on, and `saveBandwidth` is unaffected
- [x] When the write fails, the saved value is unchanged and the caller gets an error
- [x] Tests cover the above

**Notes:**

- Decision: CLAUDE.md's storage rule was replaced (your option 3): only `background/` writes to `chrome.storage`; reads go through the settings read helper in `shared/`. Enforced by ESLint `no-restricted-syntax` (not dependency-cruiser, which only sees imports, not `chrome.storage` calls): any `chrome.storage` use outside `background/` and `shared/settings/` fails, and `shared/settings/` may not call set/remove/clear.
- Each saved value is its own storage key, so a write never rewrites the other value (`GLB-013`). Nothing is written on first run; a missing key reads as the default.
- The background checks the value with the same schema the readers use before writing, and only accepts messages from this extension.
- A request that cannot reach the background returns `background-unavailable`; a read failure rejects, and the caller decides what to show (task 3).
- Browser tests cover a real restart (same profile, relaunched) and a real full-quota write failure.


### 3. Side panel switch

**Goal:** The side panel shows one labelled Audio only switch that always matches the saved value.

**Implements:** PLY-004, PLY-005 (side panel), GLB-009, GLB-010

**In scope:**

- The side panel page, styled like the prototype's header and Audio only card (logo, name, switch, status line)
- `sidepanel/core/`: reads the value, follows its changes, sends the set request
- `sidepanel/ui/`: a switch component and the card, presentational only
- Light and dark colours that follow the system's setting (the SET-029 default); no theme choice yet
- If saving fails, the switch returns to its saved position and a short message says the change couldn't be saved

**Out of scope:**

- Tabs, Settings gear and every other part of the prototype's panel
- The "lowest quality requested" part of the status line — task 6

**Done when:**

- [x] The switch shows the saved value when the panel opens
- [x] Turning the switch saves the new value
- [x] With panels open in two windows, changing one updates the other within 1 second
- [x] When saving fails, the switch goes back and the message appears
- [x] The switch works by keyboard and is announced as a switch with its on or off state
- [x] The panel is usable from 320 to 600 px wide
- [x] Logic tests cover `sidepanel/core/` without importing any `.svelte` file

**Notes:**

- The whole Audio only card is the switch (one button, `role="switch"`, labelled "Audio only"), instead of the prototype's card plus an inner switch, so there is one tab stop and a larger target. Look and wording follow the prototype.
- `theme.css` now holds the prototype's light and dark palette, type sizes, radii and the red accent as tokens. Dark follows the system setting; no theme choice yet.
- `sidepanel/core/audio-only.ts` is a plain controller (`get`, `subscribe`, `toggle`, `set`): it shows the new position at once, goes back to the last saved value if saving fails, and shows the message for 6 seconds. Svelte components only render it.
- Until the saved value is read the card is not shown, so the switch never flashes the wrong position. If reading fails, the panel shows the default and a "Couldn't read your saved setting" message (not in the plan; added so a read failure isn't silent).
- A second change is ignored while the previous one is still being saved.
- Window width was checked at 320, 420 and 600 px (no horizontal overflow, switch fully inside). The "lowest quality requested" status text is left for task 6.


### 4. Overlay on YouTube

**Goal:** While audio-only is on, the player on YouTube watch pages is covered by the plain cover, and Show video turns audio-only off.

**Implements:** PLY-005 (page), PLY-006, PLY-009, PLY-010, PLY-011, PLY-012, PLY-022, PLY-141; decisions a, c, f and g

**In scope:**

- A content script on `www.youtube.com` that finds the main player on watch pages, including live streams and premieres
- Following YouTube's in-page navigation, so the overlay is right after moving to another video without a reload
- The overlay placed inside the player element, covering the picture, controls and captions, with the AudioTube logo, the label "Audio only" and a Show video button
- Show video sends the request to turn audio-only off; the overlay goes once the saved value changes
- The overlay appears or goes when the value changes anywhere
- Plain CSS scoped to the extension's own elements
- Adding the content script to YouTube tabs already open when the extension is installed or updated

**Out of scope:**

- The rest of section 4.2: fullscreen and theater checks (PLY-013), YouTube's mini-player (PLY-014), ambient glow (PLY-015), picture-in-picture (PLY-016), no-flash loading (PLY-017), click to pause (PLY-018), keyboard pass-through checks (PLY-019), error screens (PLY-020), the "Couldn't cover" message (PLY-021)
- Shorts, embedded players and other YouTube sites

**Done when:**

- [x] On a local test page that copies YouTube's player structure (served at a `www.youtube.com` address through Playwright's request routing), the overlay covers the player while audio-only is on and nothing under it can be clicked
- [x] Turning the side panel switch off removes the overlay within 1 second; turning it on brings it back
- [x] Show video removes the overlay and the side panel switch shows off
- [x] After an in-page move to another video, the overlay is still correct
- [x] After installing the extension, an already-open YouTube tab gets the overlay without a reload
- [x] Manual check on real YouTube passes: normal video, live stream, moving between videos, already-open tab

**Notes:** Tests against the real YouTube break whenever YouTube changes its page, so automated tests use the local test page and real YouTube is checked by hand.
- The content script is built as a standalone IIFE (`contentScripts.standaloneFiles`), so it loads with no loader file and adds nothing to `web_accessible_resources`. Its CSS lives in the overlay's shadow root as a constructed stylesheet, so YouTube's styles and CSP cannot reach it.
- A guard makes injecting it twice (manifest, then the install-time injection) a no-op.
- "Already-open tab" is covered in pieces, not as one end-to-end test: unit tests for the install handler and the tab injection, and a browser test that injects the built script into an open tab with no reload (once or twice, still one overlay). Chrome could not be made to fire the install/update event for an extension reloaded under test, so the full install flow has not been exercised in a real browser. Worth one manual check: load the build, open a YouTube tab first, then click reload on the extension.
- Real YouTube was checked with a headless, signed-out Chromium: a normal video, a live stream, an in-page move to a suggested video (no reload), and the home page. The overlay was inside `#movie_player` and exactly its size each time. A premiere uses the same player and was not checked separately. The cookie-consent dialog on a fresh profile blocks clicks on the page, which is why clicks there were done from script.
- Left for later (as planned): the rest of section 4.2, and the overlay does not yet appear for YouTube's mini-player.


### 5. Spike: requesting the lowest quality

**Goal:** Find out whether the extension can reliably ask YouTube's player for its lowest quality, and restore the previous quality afterwards.

**Implements:** OQ-001 (Save bandwidth), groundwork for PLY-008; decision e

**In scope:**

- A throwaway script running in the page (not the content script, which cannot reach YouTube's player object)
- Trying the player's own quality methods on: a normal video, a live stream, a premiere, signed in and signed out, after moving to another video, and during an ad
- Checking how to read the quality in use before the change, and how to tell whether the request worked

**Out of scope:**

- Production code — task 6

**Done when:**

- [x] Findings written in `docs/spikes/save-bandwidth.md`: what works, how reliable it is, how failure shows, and a recommendation (build PLY-008 as written, build it differently, or reword it)

**Notes:**

- Recommendation: build PLY-008 as written, asking for the last non-auto level with `setPlaybackQualityRange(q, q)`. Findings in `docs/spikes/save-bandwidth.md`.
- Decision e is refined by the findings: "previous quality" is the stored YouTube preference (`localStorage['yt-player-quality']`), because YouTube saves every request as the user's own setting and `getPlaybackQuality()` under Auto reports the auto-picked level. The extension also keeps its own copy so it can restore after a restart.
- Not verified in this environment: live streams, premieres, signed-in accounts. Task 6's manual check must cover them.


### 6. Save bandwidth

**Goal:** While audio-only and Save bandwidth are both on, the extension asks YouTube for the lowest quality, and restores the previous quality when audio-only turns off.

**Implements:** PLY-008; decisions d and e

**In scope:**

- The page script in `inject/`, using the approach the spike recommends
- Typed messages between the content script and the page script
- Remembering the quality in use before audio-only turned on (falling back to Auto), requesting the lowest quality for each new video while on, and restoring the remembered quality when turned off
- The side panel's status line showing "lowest quality requested" while it applies

**Out of scope:**

- A switch for Save bandwidth — section 7

**Done when:**

- [x] On the local test page, with a fake player object, turning audio-only on requests the lowest quality and turning it off restores the earlier quality
- [x] Moving to another video while on requests the lowest quality again
- [x] With `saveBandwidth` off, no quality is requested
- [x] If the request fails, audio keeps playing and nothing else breaks
- [x] Manual check on real YouTube passes

**Notes:** If the spike finds the request can't be made reliably, this task is replaced by whatever the spike recommends.
- Built as the spike recommended. The page script (`inject/`, a second content script with `world: 'MAIN'`) asks for the last non-auto level with `setPlaybackQualityRange(q, q)`. Content and page script talk over typed `window.postMessage` messages defined in `shared/page-messages.ts`.
- "Previous quality" is YouTube's stored preference (`localStorage['yt-player-quality']`, Auto if missing or unreadable), kept in the page's own storage under `audiotube.previousQuality`, so a reload or restart while audio-only is on still puts back the user's own choice and not the lowest. If another tab restores first, the second tab puts back the current preference.
- The mode is repeated to the page script when it starts, and the page script ignores a repeat of the mode it already has. When the player has no quality levels yet (not loaded, or a stream that never starts) it retries every 500 ms up to 10 times and then stays quiet.
- Not re-checked after an ad ends: the stored preference already makes the next video target the lowest, and the request is repeated on each in-page move. The side panel shows "Video hidden · lowest quality requested" whenever audio-only and Save bandwidth are both on, whether or not YouTube honoured the request.
- Manual check on real YouTube (headless, signed out, with a 720p preference set): on by default → 144p; after a reload → still 144p with 720 remembered; off → back to 720p; on again → 144p; in-page move to another video → preference stays 144; Save bandwidth off + audio-only off → 720p, nothing left remembered. Not checked: live streams (the stream did not start in this environment), premieres, signed-in accounts.


### 7. Audio only button in YouTube's control bar

**Goal:** While the video is shown, YouTube's control bar has a small Audio only button that turns audio-only back on.

**Implements:** PLY-007; decision h

**In scope:**

- A button added to the player's control bar while audio-only is off
- Pressing it sends the request to turn audio-only on
- If the control bar can't be found, no button appears and nothing else breaks

**Out of scope:**

- Other buttons on YouTube's pages (OQ-003)

**Done when:**

- [x] On the local test page, the button appears while audio-only is off and turns it on when pressed
- [x] If the control bar is missing, there is no button and no error
- [x] Manual check on real YouTube passes

**Notes:** This depends on YouTube's page structure, which changes without notice. If it proves unreliable, it is left out of the first release (decision h).
- The button is a headphones icon in a shadow root, placed first in `.ytp-right-controls-left` (the newer grouped layout) or, if that group is absent, `.ytp-right-controls`. It has the label and tooltip "Audio only" and appears only while audio-only is off on a watch page. If neither container is found, or anything in placing it throws, nothing is shown.
- Checked on real YouTube (headless, signed out, consent accepted): the button sits at the start of the right-hand controls beside the subtitles and settings buttons, pressing it brings the overlay back and the button goes away. Its look is a plain 48 px icon button, not YouTube's own `ytp-button` classes, so it will not pick up YouTube's tooltip or hover styling; YouTube's own class names were avoided on purpose.
- Decision h still holds: this is the most fragile piece, since it depends on YouTube's control bar markup. It is separate from everything else, so it can be dropped without touching the rest.
- The observer that re-checks the page after YouTube changes it was pulled out of the overlay controller into `content/page-changes.ts` and is shared by both.

