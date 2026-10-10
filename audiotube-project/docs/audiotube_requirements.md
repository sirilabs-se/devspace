# AudioTube — Requirements

**Version:** 1.2 · **Status:** Draft · **Last updated:** 2026-10-09

In this document, "shall" means required for v1, "should" means intended for v1 but may slip, and
"may" means optional. Every requirement has a stable ID made of an area prefix and a number: GLB
(global rules), PLY (Player), QUE (Queue), PLS (Playlists), SET (Settings), NG (non-goals), OQ (open
questions). IDs are never renumbered or reused. A new requirement takes the next free number in its
area.

## 1. Purpose

AudioTube is a Chrome extension that plays YouTube videos audio-only in the background. It hides the
video, asks YouTube for the lowest available video quality where it can, to reduce bandwidth (Save
bandwidth can be turned off in Settings), and provides a persistent side panel mini player — so the
user can browse other tabs while a video keeps playing as audio. It is intended for public users.

## 2. Glossary

- **Playback tab** — the single YouTube tab whose video is currently playing. There is at most one
  across all browser windows.
- **Now Playing** — the single video that is playing or paused as the current item. There may be
  none (idle).
- **Queue** — the ordered list of videos waiting to play. Now Playing is not in it. The Queue is the
  second tab of the side panel.
- **Queue entry** — one waiting video in the Queue.
- **Previous / Previous record** — a hidden record of videos that were Now Playing and left it, most
  recent last. Used only so a Previous action has somewhere to go back to. It is never shown as a
  list.
- **Audio-only mode** — the single saved state that decides whether the overlay covers YouTube's
  player. It is the same value everywhere it is shown.
- **Overlay** — the cover placed over YouTube's player, hiding the picture, YouTube's controls and
  captions.
- **Cover** — what the overlay displays. In v1 it is one fixed plain cover: the AudioTube logo and
  the label "Audio only".
- **Mini-player (YouTube's)** — YouTube's own small corner player that keeps a video playing when
  the user leaves its watch page. Not an AudioTube component.
- **Panel mini-player** — the extension's compact player shown in the side panel when the Player tab
  is not open. Not to be confused with YouTube's own mini-player.
- **Side panel** — Chrome's native side panel, with three tabs (Player, Queue, Playlists) and a
  Settings screen opened from a gear icon.
- **Player tab** — the first tab of the side panel. Always present; its content changes with
  playback state.
- **Playback options** — the panel one tap from the Player tab that holds speed, sleep timer, Voice
  boost, audio tracks, the autoplay setting and Stop.
- **Idle** — nothing is Now Playing.
- **Play now** — making a video Now Playing immediately (the "Listen" action).
- **Play** — replacing the Queue with a playlist and starting it.
- **Play shuffled** — the same as Play, with the playlist's videos in random order.
- **Autoplay toggle** — the setting "Turn off YouTube autoplay". Default OFF.
- **Listening** — a video is being listened to when audio-only mode is on, or the Queue has videos,
  or the video was started by an extension action (Listen, Play, Play shuffled, Resume, or Queue
  advance). This decides when the extension may change YouTube's own behavior.
- **Playback tab lost** — the playback tab was closed, left YouTube, crashed, was discarded by the
  browser, or its page was unloaded.
- **Ad** — an advertisement shown by YouTube before, during or after a video.
- **Available** — YouTube has shown the video to be playable.
- **Unavailable** — YouTube gave a definitive signal that the video cannot be played (deleted,
  private, blocked in the user's country, or needing a sign-in, membership or age confirmation the
  user has not completed).
- **Unknown** — the video's availability has not been determined, or the last check failed for a
  temporary reason such as no network.
- **Playable** — a video that is Available or Unknown.
- **Encounter** — the extension sees the video on a YouTube page, in the player, or while attempting
  to play it.
- **Save picker** — the small list of playlists used to add a video to a playlist or remove it.
- **Stop** — pausing playback and clearing Now Playing while keeping the Queue.

## 3. Global Rules

**Design constraint:** AudioTube is built to operate within YouTube's terms of service. Every rule
below follows from that constraint.

- **GLB-001** There shall be at most one playback tab across all browser windows.
- **GLB-002** There shall be at most one Now Playing video at any time. There may be none.
- **GLB-003** Audio shall always come from YouTube's own player. The extension shall never play
  audio itself.
- **GLB-004** The extension shall not close or reload the playback tab on its own.
- **GLB-005** The extension shall never skip, block, mute, or speed up an ad on its own. Ads always
  play through.
- **GLB-006** Queue and playback actions shall not change playlists.
- **GLB-007** Playlist changes shall not change the Queue or playback, even if the affected video is
  currently queued or playing.
- **GLB-008** The only actions that move videos between playlists and the Queue are the explicit
  ones: Add to queue, Play next, Play now, Play, Play shuffled, Save, and Save as playlist.
- **GLB-009** If a change cannot be stored (for example, the storage quota is exceeded), the system
  shall tell the user.
- **GLB-010** When a change cannot be stored, the system shall not show the change as saved, and
  shall keep the previous stored state intact.
- **GLB-011** All user data (playlists, the Queue, the Previous record, and settings) shall stay on
  the device.
- **GLB-012** Nothing about what the user listens to shall be sent anywhere. The only data that
  leaves the device is a playlist the user chooses to export.
- **GLB-013** When several windows are open, each change shall be applied against the latest stored
  data, never by overwriting a whole collection from stale state.
- **GLB-014** When several windows are open, each window shall update when stored data changes.
- **GLB-015** An action that offers Undo shall not ask for confirmation first.
- **GLB-016** An Undo offer shall last about 10 seconds.
- **GLB-017** Only one Undo offer shall be shown at a time. A new undoable action replaces it, and
  the earlier action becomes final.
- **GLB-018** If the interface closes before an Undo offer expires, the action is final.

## 4. Player Tab

The Player is how the extension plays and controls a video's audio. The extension makes no sound of
its own: audio always comes from YouTube's own player in a YouTube tab. The Player covers that
player with an overlay when audio-only mode is on, reports what is playing, and lets the user
control playback from the side panel.

The main scenario: a video plays in one YouTube tab while the user browses other websites in other
tabs, or works in another application. Audio-only mode may be on or off.

Audio-only mode is the core feature. The Queue and Playlists are optional: a user who only listens
to single videos is fully served by the Player alone.

The Player has ten jobs: **audio-only mode** (the saved state), **overlay** (the cover over
YouTube's player), **cover** (what the overlay shows), **where audio plays from** (the playback
tab), **playback controls**, **playback options** (the Playback options panel), **ads**,
**failures**, **panel and system integration**, and **persistence and independence**.

### 4.1 Audio-only mode

- **PLY-001** Audio-only mode shall be one saved value for the whole extension. The sidebar switch,
  the overlay's Show video button, and the Settings option shall all read and change this same
  value.
- **PLY-002** On first use the value shall be on.
- **PLY-003** If the user turns audio-only off, it shall stay off for all following videos until the
  user turns it on again. It shall persist across browser restarts.
- **PLY-004** The sidebar shall offer a single labelled toggle switch, Audio only, with its on or
  off state clearly visible. It shall not be two separate buttons.
- **PLY-005** Changing the value in one place shall update the others immediately, so they can never
  disagree.
- **PLY-006** While audio-only is on, the overlay shall be applied to the main video player on
  YouTube watch pages, including live streams and premieres. Shorts and players embedded on other
  websites are out of scope.
- **PLY-007** While the video is shown, YouTube's own control bar should offer a small Audio only
  button that turns audio-only back on.
- **PLY-008** When audio-only is on and Save bandwidth is on, the extension should request the
  lowest video quality for the playing video, and should restore the previous quality when
  audio-only is turned off.

### 4.2 Overlay

- **PLY-009** While audio-only is on, the overlay shall cover the entire player area: the picture,
  YouTube's control bar and buttons, and captions. None of them shall be visible or clickable
  through the overlay.
- **PLY-010** The overlay shall show the fixed cover (PLY-141) and a Show video button.
- **PLY-011** Pressing Show video shall remove the overlay immediately, show all of YouTube's
  controls, and turn audio-only off.
- **PLY-012** The overlay shall be part of the player element, not placed on top of the page, so
  that it resizes and moves with the player.
- **PLY-013** The overlay shall stay in place and fully cover the player in theater mode,
  fullscreen, and when the browser window is resized.
- **PLY-014** The overlay shall also cover YouTube's mini-player whenever audio-only is on.
- **PLY-015** While audio-only is on, YouTube's ambient-mode glow (the colored lighting around the
  player that follows the video) shall be hidden, so the video's colors do not show around the
  overlay.
- **PLY-016** While audio-only is on, the browser's picture-in-picture view of the video shall be
  disabled.
- **PLY-017** The overlay should be in place before the picture is shown when a page loads or the
  video changes, so the picture never flashes.
- **PLY-018** Clicking the overlay (outside the Show video button) shall pause the video if it is
  playing and resume it if it is paused, as clicking YouTube's video does.
- **PLY-019** The overlay shall not capture keystrokes. YouTube's keyboard shortcuts (for example
  space, K, arrow keys, M) shall continue to work.
- **PLY-020** The overlay shall stay in place when YouTube shows an error screen. It also stays in
  place during ads (see PLY-094).
- **PLY-021** If the overlay cannot be applied (for example, YouTube's page changed and the player
  cannot be found), the sidebar shall say so, for example "Couldn't cover YouTube's player on this
  page". Audio shall keep playing.
- **PLY-022** The overlay shall be present if and only if audio-only is on and a YouTube watch-page
  player (or YouTube's mini-player) is present.

### 4.3 Cover

- **PLY-141** The overlay shall show one fixed cover in v1: the AudioTube logo and the label "Audio
  only", on a plain surface.
- **PLY-142** The cover shall not be configurable in v1 (see FS-002).
- **PLY-036** The side panel shall show the video's thumbnail and information, not the cover.

### 4.4 Where audio plays from

- **PLY-037** Audio shall come from YouTube's own player in the playback tab (see GLB-003).
- **PLY-038** The video in the playback tab's main player is Now Playing. The Player shall report
  its video ID to the Queue within 1 second of it changing. When the user plays a video on YouTube
  without using the extension, that video becomes Now Playing and the previous one goes to the
  Previous record.
- **PLY-039** At most one playback tab exists across all browser windows (see GLB-001).
- **PLY-040** When a video starts playing in another YouTube tab, that tab shall become the playback
  tab and the previous playback tab's video shall be paused, not closed.
- **PLY-041** If playback must start and no playback tab exists (for example, Play on a playlist
  from the side panel while no YouTube tab is open), the extension shall open a new YouTube tab in
  the background for it, without taking focus.
- **PLY-042** When the Queue (or a playlist action) starts the next video, the extension shall load
  it in the existing playback tab.
- **PLY-043** If the playback tab is visible and showing a page that is not a video page (home,
  search, a channel), loading the next video should not navigate that page away. The video shall
  load into YouTube's mini-player instead.
- **PLY-044** If the user moves within the playback tab to a YouTube page that is not a video page,
  audio shall keep playing in YouTube's mini-player, covered by the overlay when audio-only is on.
- **PLY-045** If the user opens a different video in the playback tab, it shall replace the current
  one, as YouTube does.
- **PLY-046** When a video is replaced this way, the previous video goes to the Previous record, and
  Previous shall bring it back.
- **PLY-047** Add to queue and Play next never navigate the page (see QUE-027).
- **PLY-048** Playback shall continue when the playback tab is in the background, its window is
  hidden or minimized, or the user is working in another tab or application. The extension shall not
  pause playback because the tab or window lost focus.
- **PLY-049** The extension shall not close or reload the playback tab on its own (see GLB-004).
- **PLY-050** The extension shall detect when the browser has discarded or unloaded the playback
  tab.
- **PLY-051** The sidebar should offer Go to video, which brings the playback tab to the front.
- **PLY-052** When the playback tab is lost, the Player shall:
  1. pause (there is nothing playing);
  2. keep Now Playing, the Queue, and the Previous record unchanged;
  3. save the position;
  4. show the video in the sidebar as paused with a Resume button.
- **PLY-053** Resume shall open the video in a new background tab, without taking focus, at the
  saved position (within about 2 seconds), and start playing. It shall not navigate or close any
  other tab.
- **PLY-054** After a browser restart there is no playback tab, so the restored session shall appear
  paused with Resume.
- **PLY-055** The side panel shall remain available and show the same state as the user switches
  between tabs in the same window, so playback can be controlled while browsing other websites.

### 4.5 Playback controls

- **PLY-056** The sidebar shall offer play/pause.
- **PLY-057** The play/pause state shall be synchronized with the page in both directions: if the
  user pauses with a keyboard shortcut or by clicking the overlay, the sidebar shall update within 1
  second.
- **PLY-058** Next and Previous shall behave as section 5.4 defines.
- **PLY-059** The sidebar shall show elapsed time, remaining time, and a progress bar that updates
  at least once per second while playing.
- **PLY-060** The user shall be able to seek by clicking or dragging the progress bar, and with the
  keyboard (arrow keys move by 5 seconds when the bar has focus). Seeking shall not change what is
  Now Playing.
- **PLY-061** The sidebar shall offer volume (0 to 100) and mute.
- **PLY-062** The sidebar's volume shall control the YouTube player's volume and shall stay in sync
  with changes made on the page.
- **PLY-063** The volume shall be remembered across sessions.
- **PLY-064** For a live stream the sidebar shall show a "Live" label and no total duration.
- **PLY-065** For a live stream, seeking shall be disabled.
- **PLY-066** Loop One is unavailable for live streams (see PLY-087).
- **PLY-067** While the video is loading or buffering, the sidebar shall show a "Buffering" state.
- **PLY-068** A video started by the extension (Listen, Play, Play shuffled, Resume, Queue advance,
  tapping a row) shall start playing automatically. A restored session shall not.
- **PLY-069** When a video ends (not an ad), the Player shall tell the Queue, and section 5.4
  applies. With Loop One on, the video repeats instead.
- **PLY-070** Stop is defined in QUE-077. The playback tab stays open.

### 4.6 Playback options

- **PLY-071** The Player tab shall offer a Playback options panel, one tap away, containing the
  options in this job. Options that are not available for the current video shall be hidden or
  disabled with a reason.
- **PLY-072** An active option shall appear as a small chip near the playback controls (for example
  "1.5×", "23 min left", "Loop"), so the user can see what is on without opening the panel.

**Playback speed**

- **PLY-073** The user shall be able to choose a speed from 0.5×, 0.75×, 1×, 1.25×, 1.5×, 1.75×, 2×.
  The default is 1×.
- **PLY-074** The chosen speed shall apply to all videos and be remembered across sessions. If the
  user changes the speed in YouTube's controls, the sidebar shall show the new speed.

**Sleep timer**

- **PLY-075** The user shall be able to set a sleep timer of 15, 30, 45 or 60 minutes, or End of
  this video.
- **PLY-076** While a timer runs, the sidebar shall show the time left. The user shall be able to
  cancel it at any time.
- **PLY-077** When the sleep timer ends, playback shall pause.
- **PLY-078** When the sleep timer ends, nothing else shall start: no Queue advance shall begin
  playing and YouTube's autoplay shall not start.
- **PLY-079** The sleep timer's countdown counts real time, including while paused.
- **PLY-080** The volume should fade out over the last 10 seconds before the timer pauses playback,
  and the original volume shall be restored for the next play.
- **PLY-081** The timer shall never clear or change the Queue. With End of this video, when the
  video ends the Queue advances as normal (the finished video goes to the Previous record and the
  next video becomes Now Playing) but the next video stays paused.
- **PLY-082** The timer shall not be restored after a browser restart.

**Loop**

- **PLY-083** Loop shall have three modes: **Off**, **One** and **Queue**. The default is Off.
- **PLY-143** Loop One shall repeat the current video.
- **PLY-084** While Loop One is on, the video does not "end", so the Queue shall not advance.
- **PLY-085** While Loop One is on, the video shall not enter the Previous record.
- **PLY-144** The Loop mode shall stay as the user set it when Now Playing changes (Next, Previous,
  tapping a row, or Play now).
- **PLY-145** The Loop mode shall return to Off after a browser restart.
- **PLY-087** Loop One shall be unavailable for live streams.
- **PLY-146** When Loop Queue is on and the Now Playing video ends with an empty Queue, the videos
  in the Previous record shall return to the Queue in their original order, the Now Playing video
  shall join the record, and playback shall continue with the first of them.
- **PLY-147** When Loop Queue is on, the Queue is empty, and the Previous record is empty, the Now
  Playing video shall repeat.
- **PLY-148** Loop Queue shall repeat at most the last 50 videos played, because that is the size of
  the Previous record.
- **PLY-149** While Loop Queue is on and the Queue is empty, Loop Queue shall take precedence over
  YouTube's autoplay and over the Autoplay toggle.
- **PLY-150** With Loop One on, **End of this video** shall pause playback at the end of the current
  play-through.

**Voice boost**

- **PLY-088** The user shall be able to turn on Voice boost, which makes speech clearer. It is off
  by default, applies to all videos, is remembered, and is processed on the device. If it cannot be
  applied, the sidebar shall say so.

**Audio tracks**

- **PLY-089** When the video has several audio tracks (for example, dubbed languages), the Playback
  options panel shall list them and let the user choose. When it has only one, this option shall not
  appear.

**Autoplay**

- **PLY-090** The Playback options panel shall include the Autoplay toggle, with the wording and
  message defined in section 5.4 (End of the Queue and YouTube autoplay).
- **PLY-091** The Autoplay toggle's scope is defined in QUE-064. When the user stops listening,
  their own YouTube autoplay setting shall be restored.

**Stop**

- **PLY-092** The Playback options panel shall include Stop, available when a video is Now Playing.
  Stop behaves as section 5.4 defines.

**Captions**

- **PLY-093** Captions shall be hidden under the overlay. No captions feature is provided in the
  sidebar.

### 4.7 Ads

- **PLY-094** The overlay shall stay in place while an ad plays. The Player shall not remove it,
  shrink it, or show the ad.
- **PLY-095** While an ad plays, the sidebar shall show "Ad playing" in place of the progress bar.
- **PLY-096** While an ad plays, seeking shall be disabled.
- **PLY-097** If YouTube provides the remaining ad time, the sidebar should show it.
- **PLY-098** Ads follow GLB-005. After an ad plays through, the video resumes.
- **PLY-099** There is no Skip ad control in the extension.
- **PLY-100** The user's own volume and mute controls apply to ads as they do to any video.
- **PLY-101** The playback speed option shall not be applied to ads. An ad plays at normal speed,
  and the chosen speed returns when the video resumes.
- **PLY-102** The end of an ad shall not be treated as the end of the video. The Queue shall advance
  only when the actual video ends.
- **PLY-103** If the Player cannot tell whether an ad or the video is playing, it shall not advance
  the Queue on that basis. The Queue advances only on a confirmed end of the video.
- **PLY-104** Ad time shall not count toward the video's position. Now Playing shall remain the
  video itself while an ad plays before or during it.
- **PLY-105** Play/pause, Next, Previous, volume, and the options in the Playback options panel
  shall keep working during an ad.
- **PLY-106** Next and Previous during an ad replace the video as they normally do. The video that
  was Now Playing goes to the Previous record even if only an ad had played.

### 4.8 Failures

- **PLY-107** The Player shall report a video as Unavailable when YouTube gives a definitive signal
  that it cannot be played (deleted, private, blocked in the user's country). This status feeds the
  shared video record.
- **PLY-108** A video that requires a sign-in, membership, or age confirmation the user has not
  completed should be reported as Unavailable, with that reason shown if known.
- **PLY-109** A failure with a temporary cause (no network, a timeout, an unknown error) shall be
  reported as Unknown, never as Unavailable.
- **PLY-110** When playback cannot start or stalls for a temporary reason, the Player shall retry
  automatically up to 3 times, waiting longer each time.
- **PLY-111** If playback still fails after the retries, the sidebar shall show "Can't play right
  now" with Retry and Skip.
- **PLY-112** A temporary playback failure shall not remove anything from the Queue automatically.
- **PLY-113** If the connection drops while a video is playing and returns later, playback should
  resume automatically, from the same position, only if it was playing when the interruption began.
- **PLY-114** When the Queue reaches an Unavailable video, the skipping rules in section 5.4
  (Unavailable videos) apply.

### 4.9 Panel and system integration

**Player tab**

- **PLY-115** The Player tab shall show: the Now Playing thumbnail, title, channel, and "views ·
  published"; elapsed time, remaining time, and progress (or the Ad, Live, and Buffering states);
  previous, play/pause, next; volume and mute; the Audio only switch; a Save control for the Now
  Playing video; Go to video; the Playback options panel (which includes Stop), with its active
  chips; and Up next.
- **PLY-116** Up next shall show up to 3 waiting videos from the Queue (fewer when the panel is
  short), each with thumbnail, title, channel, and duration, with a link to the Queue tab.
- **PLY-117** Tapping a video in Up next shall play it, as tapping a Queue row does (see QUE-043).
- **PLY-118** When the Queue is empty, Up next shall show one short hint instead of an empty box.
- **PLY-151** The empty-Queue hint in Up next shall say what happens when the video ends: that
  YouTube will choose what plays next when the Autoplay toggle is OFF, or that playback stops when
  it is ON.
- **PLY-119** When nothing is playing, the Player tab shall show a "Nothing playing" state. Previous
  shall stay available while the Previous record is not empty.
- **PLY-120** The Player tab shall clearly show these states: Ad playing, Buffering, Live, Can't
  play right now (with Retry and Skip), Playback tab lost (paused, with Resume), and Couldn't cover
  YouTube's player.

**Panel mini-player**

- **PLY-121** When the Player tab is not open (the Queue or Playlists tab, or Settings, is shown),
  the panel mini-player shall be shown, with: thumbnail, title, channel, previous, play/pause, next,
  and a thin progress line.
- **PLY-122** Tapping the panel mini-player shall open the Player tab.
- **PLY-123** The panel mini-player shall not exist when nothing is Now Playing.
- **PLY-124** The Player tab and panel mini-player shall work at panel widths from about 320 to 600
  px, with the default at 420 px, and shall be usable with one hand.
- **PLY-125** Which video is playing and whether it is paused should be clear at a glance, from the
  panel mini-player.
- **PLY-126** While an ad plays, the panel mini-player should show "Ad playing" in place of the
  progress line.

**System integration**

- **PLY-127** The extension shall publish the Now Playing title, channel, and thumbnail to the
  browser's media controls, so they appear in Chrome's media hub and on the system's media controls.
- **PLY-128** The keyboard's media keys and headphone buttons shall control the extension's
  playback: play/pause, next, previous, and seek. Next and Previous shall follow section 5.4.
- **PLY-129** When the extension is playing, its controls shall be the ones the system's media
  controls target, not another tab's.

### 4.10 Persistence and independence

- **PLY-130** The playback position shall be saved at least every 5 seconds while playing, and on
  pause, tab loss, and when the panel closes.
- **PLY-131** The audio-only state, volume, speed and Voice boost shall persist across sessions.
  Loop and the sleep timer shall not.
- **PLY-132** Player data shall stay on the device (see GLB-011 and GLB-012).
- **PLY-133** Failed saves follow GLB-009 and GLB-010.
- **PLY-134** Audio-only mode and the playback options shall not change the Queue or any playlist,
  except as stated here (Loop and the sleep timer affect when the Queue advances). The Queue and
  playlists shall not change audio-only mode.

**Invariants**

These must always hold:

- **PLY-135** At most one playback tab (GLB-001).
- **PLY-136** At most one Now Playing video (GLB-002).
- **PLY-137** Audio-only is a single shared value (PLY-001).
- **PLY-138** The overlay is present exactly when audio-only is on and a player is present
  (PLY-022).
- **PLY-139** Ads always play (GLB-005).
- **PLY-140** The Queue advances only at the end of the video, never at the end of an ad (PLY-102).

### 4.11 Acceptance examples

**PLY-EX-A · First use**
```
Install → audio-only is on.
Play a video → the overlay covers the picture, YouTube's controls and captions.
The sidebar shows the thumbnail, title, channel, and the Audio only switch (on).
```

**PLY-EX-B · Show video stays off**
```
Press "Show video" → overlay gone, YouTube's controls shown, the sidebar switch is off.
Open the next video → still no overlay.
Turn the switch on → overlay returns.
```

**PLY-EX-C · Ad plays**
```
Ad before the video → the overlay stays. Sidebar: "Ad playing".
The ad ends → the Queue does NOT advance. Now Playing is still the video.
```

**PLY-EX-D · Working elsewhere**
```
Video plays in tab 1. The user switches to a bank's website in tab 2.
Audio continues. The panel is still there. Pause and Next work from tab 2.
Media keys control the extension.
```

**PLY-EX-E · Leaving the video page**
```
Playing in tab 1. The user opens YouTube's home page in tab 1.
Audio continues in YouTube's mini-player, covered by the overlay.
```

**PLY-EX-F · Opening a different video in the same tab**
```
Playing A. The user opens B in the same tab → B plays, A is in the Previous record.
Previous → A plays again.
```

**PLY-EX-G · Closing the playback tab**
```
Playing A at 12:30. The user closes the tab.
Sidebar: A is shown paused at 12:30 with "Resume".
Resume → a new background tab opens; A plays from 12:30. Focus does not move.
```

**PLY-EX-H · Another YouTube tab starts a video**
```
Tab 1 plays A. The user plays B in tab 2.
Tab 2 becomes the playback tab. A in tab 1 is paused (not closed). A is in the Previous record.
```

**PLY-EX-I · Theater mode, fullscreen, and ambient glow**
```
Theater mode → the overlay resizes to the wider player.
Fullscreen → the overlay still covers everything.
The ambient glow is not visible around the overlay.
```

**PLY-EX-J · Sleep timer, end of video**
```
Now Playing: A   Queue: B C     Timer: End of this video
A ends → B becomes Now Playing but stays paused. Queue: C. Nothing else starts.
```

**PLY-EX-K · Loop**
```
Loop One on, A plays to the end → A starts again. The Queue is unchanged, A is not in the record.
Next → B plays and Loop One stays on.
```

**PLY-EX-L · Temporary failure**
```
Network drops while starting B → retries up to 3 times.
Still failing → "Can't play right now", with Retry and Skip. B stays in place.
```

**PLY-EX-M · Overlay cannot be applied**
```
YouTube changes its page and the player cannot be found.
Sidebar: "Couldn't cover YouTube's player on this page". Audio keeps playing.
```

**PLY-EX-N · Speed and ads**
```
Speed is 2×. A pre-roll ad starts and plays at normal speed.
The video begins and 2× returns. Muting during the ad is allowed and stays as the user set it.
```

**PLY-EX-O · Loop Queue**
```
Loop Queue on. Played so far: A, B (the record). Now Playing: C. Queue: empty.
C ends → A and B return to the Queue in that order, C joins the record, and A plays.
A single video with nothing else played: Loop Queue repeats it.
```

## 5. Queue Tab

The Queue is the list of videos the user has chosen to listen to next. Videos wait in order, play
one after another, and leave the list once they start playing.

> Playlists store what the user wants to keep. The Queue stores what the user
> wants to hear next. The Player plays what the Queue tells it to play.

The Queue has four jobs: **fill** (add videos, from YouTube or from playlists), **play** (advance,
next, previous, end-of-queue), **edit** (reorder, remove, shuffle, clear, undo), and **keep**
(persist, and save back out to a playlist).

All four jobs are specified. Adding from playlists and saving to playlists are covered in section 6.

### 5.1 Contents

- **QUE-001** The Queue shall be an ordered collection of videos waiting to play. The order of the
  Queue is the order in which videos play.
- **QUE-002** The Now Playing video shall not be a Queue entry.
- **QUE-003** The Queue shall hold at most 1000 videos.
- **QUE-004** A video shall occur at most once in the Queue.
- **QUE-005** A video shall never be both in the Queue and Now Playing at the same time.
- **QUE-006** An empty Queue is valid.
- **QUE-007** A video shall leave the Queue when it becomes Now Playing, or when the user removes
  it, clears the Queue, or skips over it.
- **QUE-008** A Queue entry shall refer to its video by video ID. Title, channel, duration and
  availability come from the shared video record.
- **QUE-009** The Queue shall be able to show how many videos are waiting and their total remaining
  duration, counting only playable videos that have a duration, with a note when some are excluded.

### 5.2 Now Playing

- **QUE-010** At most one Now Playing video exists at any time, and there may be none (idle) (see
  GLB-002).
- **QUE-011** Whenever a video becomes Now Playing by any route (finishing, Next, Previous, tapping
  a row, Play now, Play), it shall be removed from the Queue if it was in it.
- **QUE-012** The Now Playing video shall not be reordered, removed, or dragged as part of the Queue
  list. It is changed only through Next, Previous, Play now, Play, or Stop.
- **QUE-013** When a video stops being Now Playing because it finished, was skipped with Next, was
  replaced by Play now or Play, or was stopped, it shall be added to the Previous record.
- **QUE-014** The user shall be able to save the Now Playing video to a playlist, using the Save
  picker (see PLS-108).

### 5.3 Fill — adding from YouTube

- **QUE-015** The user shall be able to add any video to the Queue without interrupting what is
  playing.
- **QUE-016** **Add to queue** shall place the video at the end of the Queue.
- **QUE-017** **Play next** shall place the video at the front of the Queue, so it plays right after
  the current video.
- **QUE-018** If the video is already in the Queue, **Play next** shall move it to the front.
- **QUE-019** If the video is already in the Queue, **Add to queue** shall change nothing, and the
  control shall show an "In queue" state.
- **QUE-020** Adding the Now Playing video shall change nothing, and the control shall show a
  "Playing" state.
- **QUE-021** A video in the Previous record may be added normally.
- **QUE-022** If nothing is Now Playing and the Queue is empty, **Add to queue** and **Play next**
  shall make the video Now Playing and start playback.
- **QUE-023** If nothing is Now Playing but the Queue has videos (after Stop), adding shall place
  the video as requested and shall not start playback.
- **QUE-024** When the Queue holds 1000 videos, adding a new video shall be refused with a clear
  message. **Play next** on a video already queued shall still be allowed, because it only moves it.
- **QUE-025** When a bulk action would only partly fit, the system shall add as many as fit, in
  order, and report how many were added and how many were not.
- **QUE-026** Adding shall be confirmed by the control changing state (for example, a check or "In
  queue"). No dialog and no success toast shall interrupt the user. Messages are shown only for
  limits, skipped items, and errors.
- **QUE-027** Adding shall not navigate the YouTube page, move focus, scroll, or pause anything.
- **QUE-028** Videos known to be Unavailable shall not be added by the add controls.
- **QUE-029** **Add all to queue** is defined in section 6.4 (see PLS-099).

**Entry points on YouTube.** Appearance, accessibility and resilience requirements for these entry
points are not yet defined (see section 8). This section defines only what each entry point does.

- **QUE-030** Right-clicking any link to a YouTube video, on any web page, shall offer **Add to
  queue** and **Play next**.
- **QUE-031** On a video's watch page, the extension shall offer **Listen** (Play now), **Add to
  queue**, **Play next** and **Save to playlist** for the video being viewed.
- **QUE-032** Video thumbnails on the home page, search results, channel pages, and the suggestions
  beside a playing video shall offer **Listen** and an overflow with **Add to queue**, **Play next**
  and **Save to playlist**.
- **QUE-033** On desktop, these thumbnail controls may appear on hover.
- **QUE-034** On touch devices, these thumbnail controls shall always be visible.
- **QUE-035** The same thumbnail controls shall be offered on other video lists where feasible
  (subscriptions, history, Watch Later, playlist pages, Shorts).
- **QUE-036** The user shall be able to add the current page's video to the Queue with a keyboard
  shortcut.
- **QUE-037** The Queue tab shall offer an "Add by link" field that accepts one or more YouTube
  video links.
- **QUE-038** The link context menu and the watch-page actions shall keep working even if the
  thumbnail controls stop working after a YouTube page change.
- **QUE-039** Videos shall be identified and links normalized as section 6.3 defines. A link that is
  not a YouTube video shall be rejected with a clear message.

### 5.4 Play — advancing, Next, Previous, and the end of the Queue

**Advancing and Next**

- **QUE-040** When the Now Playing video finishes and the Queue has videos, the first Queue entry
  shall become Now Playing and play automatically. The finished video goes to the Previous record.
- **QUE-041** **Next** shall do the same as automatic advance, on the user's request.
- **QUE-042** When the Queue is empty:
  - if the Autoplay toggle is OFF, Next shall continue as described under End of the Queue and
    YouTube autoplay;
  - if the Autoplay toggle is ON, Next shall be disabled.
- **QUE-137** When Loop Queue is on, the two cases above do not apply: Next with an empty Queue
  shall continue as Loop Queue describes (see PLY-146).
- **QUE-043** Tapping a Queue row shall make that video Now Playing.
- **QUE-044** The Queue entries above the tapped row shall be removed from the Queue (they were
  skipped).
- **QUE-045** The skipped entries shall not be added to the Previous record, because they never
  played.
- **QUE-046** The previous Now Playing video goes to the Previous record.
- **QUE-047** Tapping a Queue row shall offer Undo, which restores the skipped entries.
- **QUE-048** Playback shall change the Queue only by removing entries as they become Now Playing.
  It shall never reorder them.
- **QUE-049** Media keys and headphone controls for next and previous shall behave as Next and
  Previous.
- **QUE-050** Play now shall keep the Queue unchanged.
- **QUE-051** Only Play and Play shuffled shall replace the whole Queue. Add to queue, Add all to
  queue, Play next and Play now shall never do so.

**Previous and the Previous record**

- **QUE-052** The system shall keep a record of videos that were Now Playing and left it, most
  recent last.
- **QUE-053** The record shall hold at most 50 videos, dropping the oldest first.
- **QUE-054** The same video may appear more than once in the record.
- **QUE-055** The record shall not be shown as a list, exported, or saved to playlists.
- **QUE-056** If the Now Playing video is more than about 3 seconds in, **Previous** shall restart
  it from the beginning.
- **QUE-057** Otherwise, if the record is not empty, **Previous** shall:
  1. make the most recent record entry Now Playing and start playing it;
  2. remove that entry from the record;
  3. place the video that was Now Playing at the front of the Queue.
- **QUE-058** If the record is empty and the Now Playing video is within its first 3 seconds,
  **Previous** shall restart it.
- **QUE-059** If the video brought back is also in the Queue, it shall be removed from the Queue.
- **QUE-060** If the Queue already holds 1000 videos, the current video cannot be placed at the
  front, so **Previous** shall restart it instead.
- **QUE-061** When nothing is playing, **Previous** shall make the most recent record entry Now
  Playing and play it. If the record is empty it shall do nothing.
- **QUE-062** A single Previous press shall always be enough. It never requires pressing twice to go
  back.
- **QUE-063** The video that was Now Playing shall not be lost when going back. It returns to the
  front of the Queue.

**End of the Queue and YouTube autoplay**

- **QUE-064** The Autoplay toggle shall apply only while the user is listening through the
  extension. When the user is simply watching YouTube, the extension shall not change YouTube's
  autoplay behavior.
- **QUE-065** While the Queue has videos, YouTube's own next-video behavior shall not start
  anything. The Queue decides what plays next.
- **QUE-066** When the Now Playing video finishes (or Next is pressed) with an empty Queue and the
  toggle OFF, YouTube's autoplay shall be allowed to continue.
- **QUE-067** The video YouTube chooses in that case shall become Now Playing, and shall not be
  added to the Queue.
- **QUE-068** When the Now Playing video finishes with an empty Queue and the toggle ON, playback
  shall stop and the extension shall be idle. Nothing else shall start.
- **QUE-069** A video chosen by YouTube's autoplay shall be treated like any Now Playing video: it
  can be saved to a playlist or queued, and it joins the Previous record when it leaves Now Playing.
- **QUE-070** If the user started listening from a YouTube playlist, the Queue shall come first.
  When the Queue is empty and the toggle is OFF, YouTube shall continue with that playlist as
  YouTube determines.
- **QUE-071** If YouTube provides no next video (for example, the end of a playlist), playback shall
  stop and the extension shall be idle.
- **QUE-072** Changing the toggle shall take effect immediately, including during playback.
- **QUE-073** When idle, the extension shall show a "nothing playing" state, with Previous still
  available while the record is not empty.
- **QUE-074** The Autoplay toggle shall appear in the Playback options panel with this wording:
  - **Label:** Turn off YouTube autoplay
  - **Description:** Stops YouTube's suggested videos while you listen.
  - **Note:** When your queue ends, playback stops. It doesn't change how YouTube works when you're
    just watching.
- **QUE-075** The Autoplay toggle shall be OFF by default.
- **QUE-076** When the user turns the toggle on, the interface shall show a short inline message
  next to it (not a dialog): "YouTube's automatic suggestions are now turned off while you listen."

**Stop**

- **QUE-077** The user shall be able to **Stop** and dismiss the current video. Playback stops, Now
  Playing becomes none, the Queue is unchanged, and the stopped video goes to the Previous record.
  Stop shall offer **Undo**.
- **QUE-078** Idle with a non-empty Queue is a valid state.
- **QUE-079** Pressing Play when idle with waiting videos shall make the first Queue entry Now
  Playing and play it. If the Queue is empty it shall do nothing.

**Unavailable videos**

- **QUE-080** A waiting video known to be Unavailable shall be shown with an "Unavailable" label. It
  stays in the Queue until it is reached or removed.
- **QUE-081** When automatic advance or Next reaches an Unavailable video, the video shall be
  skipped: it leaves the Queue, does not become Now Playing, is not added to the Previous record,
  and the next playable video plays. A quiet one-line note shall say what was skipped (for example,
  "Skipped unavailable: Title").
- **QUE-082** Any number of consecutive Unavailable videos shall be skipped in turn.
- **QUE-083** If every remaining video is skipped, the rules under End of the Queue and YouTube
  autoplay apply.
- **QUE-084** Temporary playback failures follow PLY-110 to PLY-112.
- **QUE-085** **Skip** in the "Can't play right now" state behaves as Next.
- **QUE-086** Availability changes from refreshes and playback shall be reflected in the Queue list.
- **QUE-087** Tapping an Unavailable row shall not try to play it.

### 5.5 Edit — reorder, remove, shuffle, clear, undo

**Queue tab and rows**

- **QUE-088** The Queue tab shall show: the Now Playing header (thumbnail, title, channel), the
  summary, the actions **Shuffle**, **Clear** and **Save as playlist**, an "Add by link" field, and
  the list of waiting videos.
- **QUE-089** **Save as playlist** shall save the Now Playing video first (if any), then the waiting
  videos in Queue order. The full rules are in PLS-117 to PLS-121.
- **QUE-090** Each row shall show a thumbnail, title, channel, duration, and an availability label
  when the video is not Available.
- **QUE-091** Each Queue row shall have a visible drag handle and a visible **remove** button.
- **QUE-092** Each Queue row shall have a menu with **Play next**, **Play last**, **Save to
  playlist** and **Remove**.
- **QUE-093** On narrow panels the remove button and menu may appear on hover or focus, and they
  shall always be available on touch devices.
- **QUE-094** Tapping a row shall play it.
- **QUE-095** An empty Queue shall show a short message explaining how to add videos.
- **QUE-096** A Queue of 1000 videos shall scroll and respond smoothly, with the list rendered as
  PLS-072 describes.
- **QUE-097** Every row action shall be reachable and operable by keyboard, and rows shall expose
  their labels to assistive technology.

**Reordering**

- **QUE-098** The user shall be able to reorder waiting videos by dragging the handle. Autoscroll
  shall work while dragging.
- **QUE-099** Reordering shall also be possible without dragging: **Play next** moves a video to the
  top, **Play last** moves it to the bottom.
- **QUE-138** Reordering should also be possible from the keyboard: Alt + ↑ / ↓ on a focused row
  moves it up or down.
- **QUE-100** A new Queue order shall be persisted as soon as it changes, as PLS-066 states for
  playlists. There is no Save button.
- **QUE-101** Reordering shall not interrupt, restart, or change Now Playing.
- **QUE-102** The Now Playing video cannot be dragged into or within the list.

**Removing**

- **QUE-103** The user shall be able to remove a waiting video with its remove button or the menu.
- **QUE-104** Removing a waiting video shall remove only that entry and keep the order of the
  others.
- **QUE-105** Removing a waiting video shall leave Now Playing untouched and shall not add anything
  to the Previous record.
- **QUE-106** Removing a waiting video shall offer **Undo** instead of asking for confirmation (see
  GLB-015).
- **QUE-107** Removing a video from the Queue shall not remove it from any playlist.
- **QUE-108** The Now Playing video shall be ended only with Next, Previous, Play now, Play, or
  Stop.

**Shuffle and Clear**

- **QUE-109** **Shuffle** shall reorder the waiting videos once, at random.
- **QUE-110** Shuffle shall not affect Now Playing and shall not interrupt or restart playback.
- **QUE-111** Shuffle shall be disabled when fewer than two videos are waiting.
- **QUE-112** After Shuffle, the list shall show the new order, which is the order in which videos
  will play. There is no shuffle mode. Videos added later go where their add action places them (end
  or front).
- **QUE-113** Shuffle shall offer **Undo**, which restores the previous order.
- **QUE-114** **Clear** shall remove all waiting videos. It shall be disabled when the Queue is
  empty.
- **QUE-115** Clear shall not stop or interrupt Now Playing, and shall not change the Previous
  record or any playlist.
- **QUE-116** Clear shall offer **Undo**, which restores the removed videos in their previous order.
- **QUE-117** After Clear, when Now Playing finishes, the rules under End of the Queue and YouTube
  autoplay apply.

**Undo**

- **QUE-118** The following shall offer **Undo** (see GLB-016): Play now over a playing video, Play,
  Play shuffled, tapping a Queue row, removing a video, Shuffle, Clear, and Stop.
- **QUE-119** Only one Undo offer is shown at a time (see GLB-017).
- **QUE-120** Undo shall restore the Queue order, Now Playing with its playback position, and the
  Previous record exactly as they were before the action.
- **QUE-121** The offer shall be withdrawn if Now Playing changes for any reason other than the
  undone action itself (for example, the video finishes or the user presses Next).
- **QUE-122** Closing the interface before an Undo offer expires makes the action final (see
  GLB-018).

### 5.6 Keep — persistence and restore

- **QUE-123** The Queue, Now Playing, its playback position, and the Previous record shall persist
  across closing the panel, reloading the extension, and restarting the browser. Each change shall
  be saved as it happens.
- **QUE-124** A restored session shall come back paused. The extension shall never start audio on
  its own after a restart.
- **QUE-125** Restoring shall not create duplicate entries and shall not change any playlist.
- **QUE-126** A saved Queue shall stay until the user changes or clears it.
- **QUE-127** Failed saves follow GLB-009 and GLB-010.
- **QUE-128** When several windows are open, they shall share one Queue.
- **QUE-129** Changes made from several windows follow GLB-013 and GLB-014.
- **QUE-130** The Queue and the Previous record shall not be exported. They stay on the device (see
  GLB-011).

**Saving to playlists.** Any Queue row, and the Now Playing header, can be saved with the Save
picker (see PLS-108). Saving a list of videos follows PLS-117 to PLS-121.

### 5.7 Invariants

These must always hold:

- **QUE-131** Queue size limit (QUE-003).
- **QUE-132** No duplicates in the Queue (QUE-004).
- **QUE-133** At most one Now Playing video (GLB-002).
- **QUE-134** Now Playing is never also in the Queue (QUE-005).
- **QUE-135** Previous record size limit (QUE-053).
- **QUE-136** The Queue order changes only through the user's actions or playback (QUE-048).

### 5.8 Acceptance examples

**QUE-EX-A · Normal listening**
```
Now Playing: A      Queue: B C D
A finishes → Now Playing: B   Queue: C D   (A is in the Previous record)
```

**QUE-EX-B · Adding**
```
Now Playing: A      Queue: B C
Add to queue D      → Queue: B C D
Add to queue C      → no change; the control shows "In queue"
Play next E         → Queue: E B C D
Play next D         → Queue: D E B C   (D is moved)
Add to queue A      → no change; the control shows "Playing"
```

**QUE-EX-C · Play now keeps the Queue**
```
Now Playing: A      Queue: B C
Listen on X         → Now Playing: X   Queue: B C   (A is in the record)
Undo                → Now Playing: A (at its position)   Queue: B C
```

**QUE-EX-D · Tapping a row**
```
Now Playing: A      Queue: B C D
Tap C               → Now Playing: C   Queue: D
B is removed and is NOT in the record. A is in the record.
Undo                → Now Playing: A   Queue: B C D
```

**QUE-EX-E · Next and Previous**
```
Now Playing: A      Queue: B C
Next                → Now Playing: B   Queue: C   record: A
Previous (within 3 s) → Now Playing: A   Queue: B C   record: empty
Previous when more than 3 s in → restarts the current video
```

**QUE-EX-F · End of the Queue**
```
Now Playing: D      Queue: empty
Toggle OFF: D finishes → YouTube's pick Y becomes Now Playing (not in the Queue).
Toggle ON:  D finishes → playback stops; the extension is idle.
```

**QUE-EX-G · Shuffle and Clear**
```
Now Playing: A      Queue: B C D E
Shuffle             → Queue: D B E C   (A keeps playing; Undo restores B C D E)
Clear               → Queue: empty     (A keeps playing; Undo restores D B E C)
```

**QUE-EX-H · Unavailable video**
```
Now Playing: A      Queue: B✕ C D     (B unavailable)
A finishes → B is skipped with a note; Now Playing: C   Queue: D
```

**QUE-EX-I · Play a playlist**
```
Now Playing: A      Queue: X Y        Playlist: M N O
Play                → Now Playing: M   Queue: N O   (A is in the record)
Undo                → Now Playing: A   Queue: X Y
Play shuffled       → for example Now Playing: O   Queue: M N
                      (the playlist itself stays M N O)
```

**QUE-EX-J · Save the Queue**
```
Previous record: X Y      Now Playing: A      Queue: B C D
Save as playlist    → Playlist: A B C D
The record is not included, and nothing in the listening state changes.
```

**QUE-EX-K · Full Queue**
```
Queue holds 1000 videos.
Add to queue Z      → refused with a message
Play next on a video already queued → allowed (it moves to the front)
```

**QUE-EX-L · Restart**
```
Now Playing: B at 1:20      Queue: C D
Browser restarts → Now Playing: B, paused at 1:20      Queue: C D
```

**QUE-EX-M · Turning on autoplay blocking**
```
Playback options → turn on "Turn off YouTube autoplay"
  → "YouTube's automatic suggestions are now turned off while you listen."
The Queue ends → playback stops. Turn it off again → YouTube's next suggestion plays after the Queue.
```

## 6. Playlists Tab

A Playlist is a persistent, ordered collection of YouTube videos that the user chose to keep.
Playlists are stored on the user's device. They are the "shelves" of the extension: kept
deliberately, edited rarely.

> Playlists store what the user wants to keep. The Queue stores what the user
> wants to listen to. The Player plays what the Queue tells it to play.

Playlists feed the Queue through **Play**, **Play shuffled** and **Add all to queue**. Playlists and
the Queue never modify each other implicitly.

The Playlist has five jobs: **keep** (the collection and its persistence), **build** (create,
rename, delete, and manage entries), **know** (video identity, records, availability), **send to
queue** (Play, Play shuffled, Add all to queue), and **move in and out** (save picker, export,
import).

### 6.1 Keep — the playlist collection

**The collection**

- **PLS-001** The collection shall hold at most 25 playlists, including the default playlist.
- **PLS-002** When 25 playlists exist, the system shall disable creating or importing a playlist and
  shall tell the user why.
- **PLS-003** When 25 playlists exist, the user shall still be able to delete a playlist to free a
  slot.
- **PLS-004** Exactly one default playlist shall always exist. It is identified by an internal flag,
  not by its name.
- **PLS-005** The default playlist shall not be deletable. The system shall not offer a delete
  action for it.
- **PLS-006** The default playlist shall always appear first in the playlist list, regardless of any
  ordering applied to other playlists.
- **PLS-007** The user shall be able to rename the default playlist under the normal naming rules.
  Its initial name shall be "Listen later".
- **PLS-008** If the default playlist is missing at startup for any reason (first run, data
  problem), the system shall create an empty one.
- **PLS-009** The default playlist shall follow every other rule in this section (limits,
  deduplication, export, and so on). Imported playlists never become the default playlist.
- **PLS-010** The playlist list shall show the default playlist first, then all other playlists
  ordered by most recently modified, newest first.

**The playlist entity**

- **PLS-011** Each playlist shall have a unique internal ID. IDs are implementation identifiers and
  are not shown to the user.
- **PLS-012** Each playlist shall store: ID, name, default flag, creation time, last- modified time,
  and its ordered entries.
- **PLS-013** Creation time is set once on creation and never changes. Last-modified time shall
  change whenever the playlist's name or entries change (add, remove, reorder, rename, import).
- **PLS-014** A name shall be trimmed of leading and trailing whitespace, runs of internal
  whitespace shall be collapsed to a single space, and the result shall be 1 to 60 characters.
- **PLS-015** Control characters shall not be allowed in names. Names are always displayed as plain
  text, never interpreted as markup.
- **PLS-016** Playlist names shall be unique. Two names are the same if they are equal after
  trimming, collapsing whitespace, Unicode normalization (NFC), and case-insensitive comparison.
- **PLS-017** Renaming a playlist to a name that differs from its current name only in case or
  spacing shall be allowed (the playlist is not compared with itself).
- **PLS-018** Name validation errors (empty, too long, already used) shall be shown inline next to
  the name field, and the field shall keep the user's text.
- **PLS-019** A playlist may contain zero videos and remains a valid playlist.

**Persistence**

- **PLS-020** Playlists shall persist between browser sessions on the user's device.
- **PLS-021** Create, rename, delete, add, remove, reorder and import shall each be persisted as
  soon as they happen.
- **PLS-022** Playlist data shall stay on the device, and leaves it only when the user exports it
  (see GLB-011 and GLB-012).
- **PLS-023** Failed saves follow GLB-009 and GLB-010.
- **PLS-024** The data design shall keep a full collection (25 playlists of 1000 entries)
  comfortably within the browser's extension storage quota, by storing metadata once per video,
  storing no images, and keeping records small. No additional storage permission shall be requested.
- **PLS-025** Several open windows follow GLB-013 and GLB-014.
- **PLS-026** A video record may be deleted only when no playlist entry, no Queue or history entry,
  and no other required state references it. Records that are still referenced shall never be
  deleted.
- **PLS-027** Because data is local, the Export action shall be easy to find. The interface shall
  tell the user, at least once, that uninstalling the extension removes its saved playlists.

### 6.2 Build — creating, renaming, deleting, and entries

**Creating playlists**

- **PLS-028** The user shall be able to create a playlist from the Playlists tab and from the Save
  picker.
- **PLS-029** When creating a playlist, the system shall ask the user for a name. A suggested name
  may be pre-filled, but the playlist is created only after the user confirms.
- **PLS-030** The name shall be entered inline (a text field in the list or the picker), not in a
  modal dialog. Enter confirms and Escape cancels.
- **PLS-031** Cancelling name entry shall create nothing.
- **PLS-032** On creation, the system shall generate an internal ID, store the name, set both
  timestamps, and persist the playlist.
- **PLS-033** When a playlist is created from the Save picker, the video being saved shall be added
  to it as its first entry.
- **PLS-034** When a playlist is created from a list of videos (for example, "Save queue as
  playlist"), the entries shall be added in the given order, limited by the 1000-entry maximum, and
  the user shall be told how many were added and how many did not fit.

**Renaming playlists**

- **PLS-035** The user shall be able to rename any playlist, including the default, inline.
- **PLS-036** Renaming shall follow the same validation as naming.
- **PLS-037** Renaming shall change only the name and the last-modified time. The ID, creation time,
  entries and order shall be unchanged.

**Deleting playlists**

- **PLS-038** The user shall be able to delete any playlist except the default playlist.
- **PLS-039** Deleting a playlist shall offer **Undo** instead of asking for confirmation (see
  GLB-015).
- **PLS-040** Deleting a playlist shall be written to storage immediately.
- **PLS-041** Undo shall restore the deleted playlist (name, entries, order, timestamps) from a
  snapshot held by the interface.
- **PLS-042** Deleting a playlist shall remove only that playlist and its entries. Videos in other
  playlists, the Queue and current playback are unaffected.
- **PLS-043** Deleting a playlist frees one of the 25 slots immediately.

**Entries**

- **PLS-044** The user shall be able to add a video to any existing playlist.
- **PLS-045** A newly added video shall be placed at the end of the playlist. The order in which
  videos were added is the default order.
- **PLS-046** A playlist shall hold at most 1000 entries.
- **PLS-047** When a playlist holds 1000 entries, adding to it shall be refused with a clear
  message.
- **PLS-048** A playlist that holds 1000 entries shall be shown as full in the Save picker.
- **PLS-049** When a bulk action would only partly fit, the system shall add as many entries as fit,
  in order, and report how many were added and how many were not.
- **PLS-050** A video shall occur at most once in any playlist. There is no setting to change this.
- **PLS-051** Adding a video that is already in the playlist shall create no new entry, shall not
  change its position, and shall not change the last-modified time.
- **PLS-052** The interface shall show that the video is already in the playlist.
- **PLS-053** A video may belong to any number of playlists. Adding it to, or removing it from, one
  playlist shall not affect any other.
- **PLS-054** Each playlist shall keep its own order. A video's position in one playlist has no
  effect on its position in another.
- **PLS-055** Each entry shall store the date it was added.

**Playlist detail and rows**

- **PLS-056** A playlist's detail view shall offer: **Play**, **Play shuffled**, **Add all to
  queue**, **Rename**, **Export**, and **Delete** (not for the default playlist). The playlist list
  shall let the user open a playlist, create a playlist, and import a playlist.
- **PLS-057** Each entry row shall show a thumbnail, the title, the channel, the duration, and its
  availability state when not Available.
- **PLS-058** Each playlist row shall have a visible add-to-queue button.
- **PLS-059** The add-to-queue button shall use an icon that is distinct from the Save "+" icon.
- **PLS-060** After the video is in the Queue (or is playing), the add-to-queue button shall show a
  check state and be inactive.
- **PLS-061** Each playlist row shall have a menu containing: **Move to top**, **Move to bottom**,
  **Remove from playlist**, and **Play next**.
- **PLS-062** On narrow panels the playlist row menu may appear on hover or focus, and it shall
  always be available on touch devices.
- **PLS-063** Tapping a row shall play that video immediately without changing the existing Queue.
- **PLS-064** The user shall be able to reorder entries by dragging a visible handle. Autoscroll
  shall work while dragging in a long list.
- **PLS-065** Reordering shall also be possible without dragging (Move to top, Move to bottom).
- **PLS-151** Reordering should also be possible from the keyboard: Alt + ↑ / ↓ on a focused row
  moves it up or down.
- **PLS-066** A new order shall be persisted as soon as it changes. There is no Save button for
  order.
- **PLS-067** Reordering shall update the last-modified time.
- **PLS-068** Removing an entry shall offer **Undo** instead of asking for confirmation (see
  GLB-015).
- **PLS-069** Removing an entry shall keep the order of the remaining entries and update the
  last-modified time.
- **PLS-070** The detail view shall offer a filter field that matches title and channel, ignoring
  case. The filter is not saved and is cleared when the user leaves the playlist.
- **PLS-071** While a filter is active, drag, Move to top and Move to bottom shall be disabled.
- **PLS-072** A playlist of 1000 entries shall scroll and respond smoothly. The list shall render
  only the rows near the viewport.

### 6.3 Know — video identity, records, availability

**Video identity and records**

- **PLS-073** A video shall be identified by its 11-character YouTube video ID. Title, channel,
  thumbnail, duration and URL are not identity.
- **PLS-074** The system shall extract the video ID from the common YouTube address forms (watch
  pages, short links, Shorts, embed links). Timestamps, playlist parameters and tracking parameters
  shall be ignored.
- **PLS-075** Video metadata shall be stored once per video and referenced by every playlist entry
  (and by the Queue and other required state). Metadata updates therefore apply consistently
  everywhere the video appears.
- **PLS-076** For each video the system shall store: video ID, title, channel name, duration (or
  none), and availability status.
- **PLS-077** Thumbnails shall be derived from the video ID rather than stored as image data.
- **PLS-078** When the extension encounters a video, its stored metadata and availability shall be
  refreshed from what YouTube currently provides.
- **PLS-079** Refreshing the same video's metadata shall happen at most about once per 24 hours,
  except that an availability change detected during playback shall be recorded immediately.
- **PLS-080** Refreshing metadata shall not add or remove entries, change order or membership, or
  add anything to the Queue.
- **PLS-081** Live streams and upcoming premieres may be saved. They have no duration and shall not
  contribute to a playlist's total duration.

**Availability**

- **PLS-082** A video that is Unavailable shall remain in its playlists. The system shall never
  remove an entry automatically.
- **PLS-083** Availability shall be refreshed only on an encounter. The system shall not check
  videos in the background.
- **PLS-084** An Unavailable video that is encountered and found playable shall become Available,
  and an Available video found not playable shall become Unavailable.
- **PLS-085** A failure with a temporary cause (for example, no network) shall set or keep the
  status as Unknown, never as Unavailable.
- **PLS-086** An Unavailable entry shall be shown dimmed with an "Unavailable" label.
- **PLS-087** An Unavailable entry's add-to-queue button shall be inactive.
- **PLS-088** Remove, Move to top and Move to bottom shall remain available for an Unavailable
  entry.
- **PLS-089** Unavailable videos shall be skipped by Play, Play shuffled and Add all to queue.
- **PLS-090** When a playlist has at least one Unavailable entry, its menu shall offer **Remove
  unavailable**, with Undo.

**Summary**

- **PLS-091** Each playlist row in the list shall show: a cover image, the name, the number of
  videos, and the total duration. The default playlist shall show a pin indicator.
- **PLS-092** The cover shall be the thumbnail of the first entry. An empty playlist shall show a
  neutral placeholder.
- **PLS-093** The total duration shall be the sum of the durations of playable videos that have a
  duration. Unavailable videos and live or upcoming videos are excluded.
- **PLS-094** When some entries are excluded from the total, the summary shall say so (for example,
  "42 min, excluding 2 unavailable").
- **PLS-095** The last-modified time is used for ordering and shall not be displayed.
- **PLS-096** The system shall not record or show when a playlist was last played.

### 6.4 Send to queue — Play, Play shuffled, Add all to queue

- **PLS-097** Each playlist shall offer **Play**. It starts a new listening sequence from the
  playlist: the first playable video becomes Now Playing and the remaining playable videos, in
  playlist order, become the Queue. The existing Queue is replaced, with Undo.
- **PLS-098** Each playlist shall offer **Play shuffled**. It starts a new listening sequence like
  **Play**, but the playable videos are put in a random order: the first video of that order becomes
  Now Playing and the rest become the Queue in that order. The existing Queue is replaced, with
  Undo.
- **PLS-099** Each playlist shall offer **Add all to queue**. It appends the playlist's playable
  videos to the end of the Queue in playlist order. It shall not replace the existing Queue or
  interrupt playback.
- **PLS-100** **Play**, **Play shuffled** and **Add all to queue** shall skip Unavailable videos.
  **Add all to queue** shall also skip videos that are already in the Queue and the video that is
  currently playing.
- **PLS-101** If nothing is playing and the Queue is empty, **Add all to queue** shall make the
  first playable video Now Playing and start playback.
- **PLS-102** If every playable video is already queued or playing, **Add all to queue** shall
  change nothing and say so.
- **PLS-103** After **Add all to queue**, the system shall report the outcome briefly, for example
  "Added 12, 3 already queued".
- **PLS-104** Play, Play shuffled and Add all to queue shall be disabled when the playlist has no
  playable videos.
- **PLS-105** None of these actions shall modify the playlist, including its order.
- **PLS-106** The add-to-queue button on a row shall behave as **Add to queue** (see QUE-016 to
  QUE-022).
- **PLS-107** When the video is already in the Queue or is playing, the add-to-queue button shall
  show its check state.

### 6.5 Move in and out — save picker, export, import

**Save picker**

- **PLS-108** The user shall be able to open the Save picker for a video from the Now Playing
  screen, from the menu of a video on YouTube, and from a video in the Queue.
- **PLS-109** The picker shall list every playlist: the default first, the others in list order.
- **PLS-110** Each picker row shall show the name, the video count, and a check mark if this video
  is already in it.
- **PLS-111** A playlist that is full shall be shown as full and not selectable.
- **PLS-112** Selecting a playlist without the check adds the video to it. Selecting a playlist with
  the check removes it, with Undo. One control therefore both saves and removes.
- **PLS-113** Adding or removing in the picker shall be confirmed by the check mark changing on that
  row, and no dialog shall interrupt the user.
- **PLS-114** The picker may stay open for several selections and closes when the user taps outside
  it.
- **PLS-115** The picker shall end with a "New playlist" row that opens inline name entry. It is
  disabled when 25 playlists exist.
- **PLS-116** The Save control on the Now Playing screen shall show whether the current video is in
  at least one playlist.

**Saving a list of videos**

- **PLS-117** Save as playlist (from the Queue), and any other action that saves a list of videos,
  shall let the user choose a new playlist or an existing one.
- **PLS-118** For a new playlist, the name shall be entered inline, with a suggested name of "Queue"
  and the date, and the playlist shall be created only after the user confirms.
- **PLS-119** For an existing playlist, videos already in it shall be skipped and new ones appended
  in order. If some would not fit under the 1000-entry limit, the user shall be told how many were
  added and how many were not.
- **PLS-120** Unavailable videos shall be included, since playlists keep them.
- **PLS-121** Saving shall not change the Queue, Now Playing, the Previous record, or playback.

**Export**

- **PLS-122** The user shall be able to export any single playlist (including the default and empty
  playlists) as one JSON file.
- **PLS-123** The file shall contain: a format identifier, a format version (initially 1), the
  export date, the playlist name, and the ordered entries. Each entry shall contain the video ID,
  title, channel, duration (or none), and the date it was added.
- **PLS-124** The file shall not contain internal playlist IDs, the default flag, or availability
  status.
- **PLS-125** The file shall preserve the playlist's entry order.
- **PLS-126** Exporting shall not change any playlist, the Queue, or playback.
- **PLS-127** The suggested file name shall be the playlist name with characters not allowed in file
  names removed, plus ".json" ("playlist.json" if nothing remains).

**Import**

- **PLS-128** Import shall read one exported file and create one new playlist.
- **PLS-129** Import shall never replace or merge into an existing playlist.
- **PLS-130** Import shall never change the default playlist.
- **PLS-131** Before anything is created, the system shall show a preview: the name (editable), the
  number of videos that will be imported, and any warnings. The user confirms or cancels. Cancelling
  creates nothing.
- **PLS-132** The imported playlist shall follow the naming rules, count toward the 25-playlist
  limit and the 1000-entry limit, and receive a new internal ID.
- **PLS-133** If the name in the file is already used, the preview shall suggest the name followed
  by " (2)" (then "(3)", and so on, shortening the base name if needed to stay within 60
  characters). The user may edit it.
- **PLS-134** The imported playlist's creation and last-modified times shall be set to the time of
  import. Each entry's added date shall be kept from the file when valid, otherwise set to the
  import time.
- **PLS-135** If the file lists the same video more than once, only the first occurrence shall be
  imported. The preview shall report how many were dropped.
- **PLS-136** Entries with an invalid video ID shall be skipped, and the preview shall report how
  many.
- **PLS-137** If the file has more than 1000 valid videos, the preview shall say that only the first
  1000 will be imported. The user may cancel.
- **PLS-138** The system shall reject the file, with a plain explanation and no change to existing
  data, if it:
  - is not valid JSON;
  - does not carry this extension's format identifier;
  - has a newer format version than the extension supports;
  - exceeds the maximum file size (5 MB); or
  - has no usable name or no valid entries after cleaning (an empty list of entries is accepted only
    if the file is otherwise valid).
- **PLS-139** Imported names, titles and channel names shall be length-limited (names 60 characters,
  titles 300, channels 100), stripped of control characters, and always displayed as plain text.
  These caps keep imported data from exceeding what YouTube itself allows, and keep records small.
- **PLS-140** For a video the extension already knows, stored metadata and availability shall be
  kept. For a new video, the file's metadata shall be stored and refreshed at the next encounter.
  Imported videos start with availability Unknown.
- **PLS-141** The playlist shall be created only after the file has been fully validated and the
  user has confirmed, so a failed import cannot leave a partial playlist.
- **PLS-142** Import shall not change other playlists, the Queue, or playback.

### 6.6 Independence

- **PLS-143** Playlist actions never change the Queue or playback, and Queue and playback actions
  never change playlists (see GLB-006 and GLB-007).
- **PLS-144** An action on one playlist shall not change any other playlist. The only shared data is
  the video record.

### 6.7 Invariants

These must always hold:

- **PLS-145** Playlist count limit (PLS-001).
- **PLS-146** Playlist size limit (PLS-046).
- **PLS-147** No duplicates within a playlist (PLS-050).
- **PLS-148** Unique playlist names (PLS-016).
- **PLS-149** Exactly one default playlist (PLS-004).
- **PLS-150** Stable playlist order (PLS-054).

### 6.8 Acceptance examples

**PLS-EX-A · Add and de-duplicate**
```
Playlist: A B C          Add D → A B C D
Playlist: A B C D        Add B → A B C D   (unchanged, B keeps its position)
```

**PLS-EX-B · One video, several playlists**
```
Music: A B     Favorites: A C
Remove A from Music → Music: B     Favorites: A C
```

**PLS-EX-C · Names**
```
Existing: "Focus"
Create "  focus " → rejected inline: already used
Create "Focus 2"  → created
Create ""         → rejected inline: name required
Rename "Focus" to "FOCUS" → allowed (same playlist)
```

**PLS-EX-D · Limits**
```
25 playlists exist → New playlist and Import are disabled, with an explanation.
Playlist has 1000 entries → Save picker shows it as full; adding is refused.
Save queue (1200 videos) to an empty playlist → 1000 added, user told 200 did not fit.
```

**PLS-EX-E · Default playlist**
```
Delete on "Listen later" → not offered.
Rename "Listen later" to "Keepers" → allowed; it is still pinned first and not deletable.
Import a file exported from the default playlist → becomes a normal playlist, never the default.
```

**PLS-EX-F · Delete with undo**
```
Delete "Focus" → gone from the list, Undo shown for about 10 s.
Undo → "Focus" returns with the same videos, order and timestamps.
The Queue and the playing video are untouched either way.
```

**PLS-EX-G · Add all to queue**
```
Playlist: A B C✕ D E     (C unavailable)
Queue: X B                Now playing: D
Add all to queue → Queue: X B A E
Skipped: C (unavailable), B (already queued), D (playing).
Message: "Added 2".
```

**PLS-EX-H · Reorder**
```
Playlist: A B C D → drag D above B → A D B C (saved immediately)
Filter active → drag handles and Move to top/bottom are disabled.
```

**PLS-EX-I · Export and import**
```
Export "Focus" (A B C) → focus.json.
Import focus.json while "Focus" exists → preview suggests "Focus (2)"; user confirms.
Result: new playlist "Focus (2)": A B C. "Focus" is unchanged.
```

**PLS-EX-J · Invalid or oversized import**
```
Not JSON, or from a newer version → rejected with a message; nothing changes.
File with 1,300 videos → preview: "Only the first 1000 will be imported"; user confirms or cancels.
File with the same video twice and one bad ID → preview: "1 duplicate dropped, 1 invalid skipped".
```

**PLS-EX-K · Playlist edited while playing**
```
Playlist: A B C    Queue: X B Y    Playing: B
Delete the playlist → Queue: X B Y, B keeps playing.
```

**PLS-EX-L · Play shuffled**
```
Playlist: A B C✕ D E     (C unavailable)
Play shuffled → a random order of A B D E, for example
                Now Playing: D   Queue: A E B
The playlist is still A B C✕ D E.
```

## 7. Settings

Settings holds the choices a user makes once and rarely changes. It is the lowest tier of the
interface: a small gear in the side panel header, never in the way of listening.

> Settings are for set-once preferences. Quick choices made while listening
> (speed, sleep timer, Loop, Voice boost) belong in the Player's Playback options panel,
> and playlist import and export belong on the Playlists tab.

Settings has four jobs: **where Settings lives** (access, order, width), **audio-only settings**,
**appearance settings**, and **keeping and resetting settings**.

### 7.1 Where Settings lives

- **SET-001** Settings shall open from a gear icon in the side panel header, and shall be available
  at all times, including when nothing is playing.
- **SET-002** The Settings screen shall have a back control that returns the user to the tab they
  came from.
- **SET-003** Settings shall be shown in this order: **Audio-only**, **Appearance**, **Keyboard
  shortcuts**, **Reset to defaults**, **About and privacy**.
- **SET-004** Every change shall take effect immediately. There shall be no Save or Apply button.
- **SET-005** Each setting shall show its current value and a short description in plain language.
- **SET-007** The panel mini-player shall behave on the Settings screen as it does on the other
  tabs.
- **SET-008** Every control shall be operable by keyboard with a visible focus indicator.
- **SET-009** Switches shall expose their on or off state, and option groups shall have labels, to
  assistive technology.
- **SET-010** Text should meet at least a 4.5:1 contrast ratio in both themes.
- **SET-011** Settings shall work at the panel widths in PLY-124.

### 7.2 Audio-only settings

- **SET-012** The setting shall be labelled **Audio-only mode**, with the description "Hide the
  video while you listen."
- **SET-013** Audio-only mode in Settings is the single saved value defined in PLY-001, and it is on
  by default.

- **SET-023** The setting shall be labelled **Save bandwidth**, with the description "Asks YouTube
  for the lowest video quality while you listen." It is on by default.
- **SET-024** Save bandwidth behaves as PLY-008 describes. Whether the video quality can be
  requested reliably is one of the unverified behaviors (see section 8).

### 7.3 Appearance settings

- **SET-029** The user shall be able to choose **System**, **Light**, or **Dark**. The default is
  **System**, which follows the browser's or operating system's light or dark setting and changes
  with it, live. If the system reports no preference, the theme shall be Light.
- **SET-030** The theme shall apply to the side panel. Controls added to YouTube's pages follow
  YouTube's own theme. The overlay keeps its own dark surface regardless of theme.
- **SET-031** The panel should open in the correct theme, without briefly showing the other one.
- **SET-032** The user shall be able to choose the accent colour: **Red**, **Orange**, **Teal**, or
  **Custom**. The default is **Red**.
- **SET-033** Each preset accent shall be tuned for each theme, so it stays readable in both.
- **SET-034** Choosing **Custom** shall open a colour picker, including when no custom colour has
  been picked yet.
- **SET-035** The last custom colour shall be remembered.
- **SET-036** If a custom colour would have less than a 3:1 contrast ratio against the panel
  background, the system shall adjust its lightness for display, keeping its hue. The stored value
  shall stay as the user chose it.
- **SET-037** Text and icons on accent-filled surfaces shall automatically use light or dark so that
  they keep at least a 4.5:1 contrast ratio.
- **SET-038** The accent shall be used for: switches that are on, the progress bar, the play button,
  the active tab, chips, links, and "In queue" and saved states.
- **SET-039** Theme and accent changes shall apply to the whole panel immediately.

### 7.4 Keeping and resetting settings

**Keyboard shortcuts**

- **SET-040** The **Keyboard shortcuts** row should list each shortcut the extension offers (for
  example, "Add current video to queue") with its current key, or "Not set". This list is read-only.
- **SET-041** A **Change shortcuts** action shall open Chrome's own extension shortcuts page in a
  new browser tab.
- **SET-042** Shortcuts shall be edited only on Chrome's page. The row shall show the new keys the
  next time it is shown.
- **SET-043** The set of shortcuts is defined by the extension, not by Settings. Settings shall list
  whatever the extension offers.

**Reset to defaults**

- **SET-044** Settings shall offer **Reset to defaults**.
- **SET-045** It shall return every setting in this section to its default: Audio-only mode, Save
  bandwidth, Theme, Accent, and the remembered custom colour (cleared).
- **SET-046** It shall not change playlists, the Queue, the Previous record, playback, volume,
  playback speed, Voice boost, or keyboard shortcuts.
- **SET-047** Reset shall offer **Undo** instead of asking for confirmation (see GLB-015).
- **SET-048** Undoing a reset shall restore every previous value, including the custom colour.
- **SET-049** Reset to defaults should be inactive when every setting is already at its default.
- **SET-050** Reset shall take effect immediately, including on the overlay and the theme.

**About and privacy**

- **SET-051** Settings shall show the extension's version.
- **SET-052** Settings shall show this statement: "Your playlists, queue and settings stay on this
  device. Nothing about what you listen to is sent anywhere."
- **SET-053** Settings should offer a **Send feedback** link.
- **SET-054** Settings should offer a link to the full privacy policy.
- **SET-055** Links shall open in a new browser tab and never inside the side panel.

**Persistence**

- **SET-056** Each setting shall be saved on the device as soon as it changes, and shall persist
  across restarts of the browser and updates of the extension.
- **SET-057** On first run every setting shall have its default.
- **SET-058** Settings stay on the device (see GLB-011).
- **SET-059** Failed saves follow GLB-009 and GLB-010.
- **SET-060** Several open windows follow GLB-013 and GLB-014.
- **SET-061** If a stored value is missing or not valid, that setting alone shall fall back to its
  default. Other settings shall be unaffected.

**Independence**

- **SET-062** Changing a setting shall not change playlists, the Queue, the Previous record, or what
  is playing. The only effect on playback is the one each setting describes (for example, Save
  bandwidth changes video quality, and Turn off YouTube autoplay decides what happens when the Queue
  ends).
- **SET-063** Each setting shall have exactly one stored value, wherever it is changed. This applies
  in particular to Audio-only mode.

**Invariants**

These must always hold:

- **SET-064** Every setting always has a valid value (SET-061).

### 7.5 Acceptance examples

**SET-EX-A · First run**
```
Install → Audio-only mode on, Save bandwidth on, Theme System, Accent Red.
```

**SET-EX-B · One value, many places**
```
Turn Audio-only mode off in Settings → the Player tab switch is off and the overlay disappears.
Press "Show video" on the overlay while it is on → Settings shows it off.
```

**SET-EX-E · Theme follows the system**
```
Theme is System and the computer switches to dark → the panel switches to dark with no reload.
Choose Light → the panel stays light, whatever the computer does.
```

**SET-EX-F · Custom colour**
```
Choose Custom → pick a very pale yellow on a light theme.
The accent is darkened for display so it stays readable; the stored colour is unchanged.
```

**SET-EX-H · Reset and Undo**
```
Choose Dark, pick a custom accent, turn Audio-only mode off.
Reset to defaults → System, Red, Audio-only on. Playlists, Queue and volume are unchanged.
Undo within 10 s → Dark, the custom accent, and audio-only off return.
```

**SET-EX-I · Shortcuts**
```
Open Settings → Keyboard shortcuts lists "Add current video to queue: Alt+Shift+Q" (or "Not set").
Change shortcuts → Chrome's shortcut page opens in a new tab.
```

**SET-EX-J · Failed save**
```
Storage is full and the user changes the accent → the user is told; the accent stays as it was.
```

## 8. Open Questions

- **OQ-001** **Unverified behaviors (technical feasibility).** The following requirements depend on
  behavior that has not been verified and needs a technical spike before it can be treated as
  certain. If any cannot be met, the requirement should be adjusted while keeping the user-visible
  promise (audio continues, and the user is told when something fails):
  - keeping audio in YouTube's mini-player when leaving a video page (see PLY-044);
  - loading the next video into the mini-player without navigating the page (see PLY-043);
  - blocking YouTube's own next-video behavior, and continuing a YouTube playlist when the Queue is
    empty (see QUE-065, QUE-070);
  - detecting ads, and knowing when an ad has ended (see PLY-095, PLY-103, PLY-102);
  - requesting the lowest video quality (Save bandwidth) (see PLY-008, SET-023);
  - choosing an audio track (see PLY-089);
  - processing audio on the device for Voice boost (see PLY-088);
  - keeping the side panel open across tabs (see PLY-055);
  - whether the browser may discard the background playback tab (see PLY-050);
  - hiding the ambient glow and disabling picture-in-picture (see PLY-015, PLY-016).
- **OQ-002** **Shorts and embedded players.** Not covered by the overlay in v1. Confirm, or add a
  later version.
- **OQ-003** **Page controls.** The Listen and queue controls on YouTube pages need their own
  requirements for appearance, accessibility and resilience when YouTube changes its pages. Not yet
  written.
- **OQ-004** **Stop's home.** Stop is in the Player tab's Playback options panel (section 4.6).
  Whether it should also appear on the panel mini-player is to be decided during interface design.
- **OQ-005** **Queue summary and lazily loaded durations.** The summary's total remaining duration
  assumes durations are available. Confirm how durations are loaded for a 1000-video Queue.
- **OQ-006** **Settings links.** The destinations of the Send feedback link and the privacy-policy
  link are not decided.
- **OQ-007** **Chrome's shortcuts page.** Confirm that the extension can open Chrome's extension
  shortcuts page and can read the keys currently assigned.
- **OQ-008** **The list of shortcuts.** Which commands the extension offers (beyond "add current
  video to queue") is not defined.
- **OQ-009** **Theme of page controls.** How the controls added to YouTube's pages adapt to
  YouTube's theme.

## 9. Non-Goals

- **NG-001** The extension does not play audio itself, and does not separate audio from video
  streams.
- **NG-002** The extension does not attempt to bypass YouTube's player, ads, or account
  restrictions.

## 10. Future Scope

**Covers and visualizers**
- **FS-001** Visualizers that react to the actual audio (the Bars and Wave covers are decorative).
- **FS-002** Choice of covers in Settings: Bars and Wave visualizers, Artwork, the user's own Image,
  and Plain, with Bars as the default.
- **FS-003** Each cover option shall be shown with a small preview, and the selected one clearly
  marked.
- **FS-004** Changing the cover shall update the overlay immediately. Cover options stay available
  while audio-only is off, with a note that they take effect when it is on.
- **FS-005** Bars and Wave shall animate while the video plays and rest while it is paused,
  buffering or stopped. They may be driven by playback state, and shall be static when the system
  asks for reduced motion.
- **FS-006** Artwork shall show the video's thumbnail with its title and channel.
- **FS-007** Image shall show the user's own picture, filling the player area, cropped to fit and
  never stretched.
- **FS-008** The user shall be able to choose an image file (JPEG, PNG or WebP, up to 5 MB). It
  shall be stored only on the device in separate browser storage, and may be resized when saved (no
  larger than 1920 px on its longest side).
- **FS-009** A file that is too large or not an image shall be rejected with a clear message, and
  nothing shall change. Choosing Image with no image set shall open the file picker.
- **FS-010** The user shall be able to replace or remove the image. Removing the chosen image shall
  switch the cover to Bars. At most one image shall be stored.
- **FS-011** The overlay should offer a quick way to cycle through covers.
- **FS-012** The accent colour shall also colour the Bars and Wave covers.

**Downloads**
- **FS-013** Downloads and offline listening.

**Premium**
- **FS-014** Premium features.

**Player**
- **FS-015** A Skip ad control (pressing YouTube's own skip button). Not in v1: the extension does
  not touch ads at all.
- **FS-016** Shorts and players embedded on other websites.
- **FS-017** Picture-in-picture while audio-only is on.
- **FS-018** A dedicated listening tab.
- **FS-019** Captions or lyrics in the sidebar.
- **FS-020** An equalizer.
- **FS-021** Casting.
- **FS-022** Simultaneous playback in several tabs.
- **FS-023** Support for other browsers and incognito windows.
- **FS-024** The YouTube Music website.

**Queue backlog (not yet scheduled)**
- **FS-025** A visible listening history, distinct from the hidden Previous record.
- **FS-026** A "Keep listening?" suggestion when the Queue ends.
- **FS-027** Exporting, importing or sharing the Queue.
- **FS-028** Multiple or named Queues.
- **FS-029** Syncing the Queue across devices.
- **FS-030** Adding a whole YouTube playlist page (a real YouTube playlist, not an AudioTube
  playlist) to the Queue in one step.
- **FS-031** Multi-select in the Queue.
- **FS-032** A filter inside the Queue, matching title and channel.

**Playlist backlog (not yet scheduled)**
- **FS-033** Playlist descriptions.
- **FS-034** Last-played information.
- **FS-035** Exporting all playlists at once.
- **FS-036** Importing into an existing playlist, and merging playlists.
- **FS-037** Importing YouTube's own playlists directly.
- **FS-038** Sorting options beyond manual order.
- **FS-039** Bulk multi-select in a playlist.
- **FS-040** Cloud sync of playlists.
- **FS-041** Sharing playlists.
- **FS-042** Background availability checks.
- **FS-043** Support for music.youtube.com and podcast pages.

**Settings backlog (not yet scheduled)**
- **FS-044** Language selection and translations.
- **FS-045** Syncing settings across devices.
- **FS-046** Per-site or per-channel settings.
- **FS-047** Notifications.
- **FS-048** Advanced or developer options.
- **FS-049** Density: a Compact or Comfortable setting that changes the spacing of the side panel.
- **FS-050** Default speed: a setting for the speed new videos start at.
- **FS-051** Default volume: a setting for the volume new sessions start at.
- **FS-052** Export settings to a file.
- **FS-053** Import settings from a file.
- **FS-054** Skip sponsor segments, shown as a setting once supported.
- **FS-055** Show chapters, shown as a setting once supported.

## 11. Changelog

| Date       | Change                                              |
|------------|-----------------------------------------------------|
| 2026-10-07 | Initial draft. Player tab specified.                |
| 2026-10-07 | Added overlay resilience behaviors (fullscreen/theater, mini-player, ads/errors, ambient glow, PiP, click-to-toggle, keyboard passthrough, failure messaging). |
| 2026-10-07 | Moved Player-to-Queue reporting into section 4; confirmed quality-forcing is unconditional. |
| 2026-10-07 | Clarified Resume semantics; folded Previous into the empty state; split Non-Goals vs Future Scope; reframed ToS line as a design constraint. |
| 2026-10-07 | Added the Queue section, organized under four jobs: fill (from YouTube), play, edit, keep. Added Queue glossary terms, global independence rule, invariants, acceptance examples, and Queue backlog to Future Scope. Recorded open questions: Stop's home, media keys, dangling Player reference, Autoplay toggle's home, playlist-dependent behavior deferred, and lazily loaded durations. |
| 2026-10-07 | Queue completeness pass: added the partial-fill rule for bulk adds, added "only Play and Play shuffled replace the Queue", noted Loop and sleep timer as specified elsewhere, clarified the dangling Player reference, and restored the deferred acceptance examples I and J. |
| 2026-10-08 | Added the Playlist section under five jobs: keep, build, know, send to queue, move in and out. Closed the deferred Queue items for adding from playlists and saving to playlists. Recorded the dangling Player references. Moved the Playlist backlog into Future Scope. Dropped the "allow duplicates in playlists" backlog item. |
| 2026-10-08 | Replaced the partial Player section with the full Player requirements, under ten jobs: audio-only mode, overlay, covers, where audio plays from, playback controls, playback options (More panel), ads, failures, panel and system integration, and persistence and independence. Added Player glossary terms. Moved the Skip ad control to Future Scope. Replaced Open Questions with the technical-feasibility list and the remaining undecided items. Removed "Loop" and "Sleep timer" from "already specified elsewhere". |
| 2026-10-08 | Added the Settings section under five jobs: where Settings lives, audio-only settings, playback settings, appearance settings, and keeping and resetting settings. Added Settings acceptance examples. Closed the "Autoplay toggle's home" open question. Added Settings items to Open Questions and a Settings backlog group to Future Scope. Removed the "Tabs still to be written" group, since all four tabs are now specified. |
| 2026-10-08 | Self-review against the four specifications. Added the missing requirement that the user's own YouTube autoplay setting is restored when they stop listening. |
| 2026-10-08 | Applied the review fixes. Ads: consolidated the ad rules (never skip, block, mute or speed up an ad on its own; user volume and mute still apply; speed does not apply to ads; Queue advances only on a confirmed end of video; Next and Previous during an ad; ad state on the panel mini-player; new Player example N). Added "Saving a list of videos" to the Playlists section. Added Stop to the More panel. Completed the glossary (Available, Unavailable, Unknown, Playable, Encounter, Save picker, Stop). Reworded Save bandwidth in the Purpose. Corrected the tabs (three tabs plus a Settings gear) and renamed the sections. Corrected Future Scope. Replaced vague cross-references with section numbers. Custom image storage and resizing. Added the version header and the shall/should definition. Assigned requirement IDs (GLB, PLY, QUE, PLS, SET, NG, OQ) and example IDs. |
| 2026-10-08 | Self-review of the numbered document. Fixed leftover vague references (the Queue section's pointer to "the Playlist section", and the reference to Page Controls requirements that do not exist yet). Aligned the Save bandwidth bullet in the Player section with Settings (should, not shall, because the behavior is unverified). Pointed the end-of-Queue references at the section that defines them. Linked each unverified behavior in Open Questions to the requirement IDs it affects. |
| 2026-10-08 | Version 1.1. Split bundled bullets so each requirement states one rule. Turned duplicated rules into one-line references by ID: added shared rules to Global Rules (failed saves, data stays on the device, several windows, Undo, independence) and pointed the Player, Queue, Playlists and Settings sections at them; replaced the restated rules in every Invariants list with references; replaced repeated image, cover, Stop, Add all, Save, width and autoplay rules with references. Unified the custom image formats (JPEG, PNG or WebP). Requirement IDs were reassigned in this pass, before any external use, and are frozen from this version. |
| 2026-10-08 | Made the Save bandwidth wording match its Should priority: the Purpose now says the extension asks YouTube for the lowest available quality where it can, to reduce bandwidth, and the Settings description now says "Asks YouTube for the lowest video quality while you listen." Neither promises a result until the technical spike confirms it. |
| 2026-10-09 | Version 1.2. Aligned with prototype v5 and v6. Cover: v1 has one fixed plain cover; the cover options, custom image rules and quick switch moved to Future Scope. Loop now has three modes (Off, One, Queue) and the mode stays until the user changes it; repeating the whole Queue is no longer out of scope. The default playlist starts as "Listen later". Panel width is 420 px by default, range 320 to 600 px. The panel mini-player gains Previous. Up next shows up to 3 videos and its empty hint says what happens next. "More panel" is now "Playback options". The autoplay setting lives only in Playback options (removed from Settings), with a shorter description. Settings: Playback section removed, Save bandwidth moved under Audio-only, Skip sponsor segments, Show chapters, Density, Default speed, Default volume, and Export and Import settings moved to Future Scope, accent options are Red, Orange, Teal and Custom with Red as the default. Added Alt + ↑ / ↓ keyboard reordering (Should). Future Scope bullets now have IDs (FS). New IDs: FS-001 to FS-055, PLS-151, PLY-141 to PLY-151, QUE-137 to QUE-138. Retired IDs, never reused: PLY-023 to PLY-035, PLY-086, SET-006, SET-014 to SET-022, SET-025 to SET-028, SET-065 to SET-066; retired examples: SET-EX-C, SET-EX-D, SET-EX-G. |

