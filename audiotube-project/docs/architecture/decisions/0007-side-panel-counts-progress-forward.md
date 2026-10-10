# 0007. The side panel counts progress forward between reports

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-11 |
| **Scope** | Side panel, background, page script |
| **Supersedes** | — |

## Context

The side panel must show elapsed time, the length of the video and a progress bar that update at least once a second while playing (`PLY-059`). Today the playback tab reports its position every 5 seconds and on every state change, and the background stores it (ADR 0003). Reporting and storing the position every second instead would wake the service worker and write storage once a second for as long as anything plays. A hidden YouTube tab's timers are also slowed down by Chrome, so a once-a-second report from the page would not arrive once a second anyway.

## Decision

The side panel works the position out itself. The background keeps one consistent snapshot in the playback tab record (`playbackTab` in session storage): the state, the position, the playback rate and the moment they were true. While the state is `playing`, the panel shows `position + (now − at) × rate`, kept between 0 and the duration, and redraws it every second with its own timer. Every report from the page replaces the snapshot, so any drift is corrected at the next one.

- The page script MUST report the state with the position and the rate whenever any of them changes outside normal playback: play, pause, buffering, ended, a seek, a rate change.
- The background MUST write the state, position, rate and time together, in one write, so the panel never mixes an old position with a new state.
- The side panel MUST NOT count forward unless the state is `playing`, and MUST NOT count past the duration. Live streams show no position.
- The position saved for Resume (`nowPlaying.positionSec`) keeps its 5-second rule (`PLY-130`); it is not used for the live display.

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Report and store the position every second | Wakes the service worker and writes storage every second; a hidden tab's slowed timers make it late anyway |
| A direct port from the side panel to the playback tab's content script, streaming the position | A second way for contexts to talk, with its own reconnect handling when the tab or worker restarts, for the same result |

## Consequences

**Good:**

- No new traffic: the reports that already exist are enough, plus seek and rate changes
- The bar moves smoothly whatever Chrome does to the hidden tab's timers

**Trade-offs:**

- If the player stalls without reporting buffering, the panel runs ahead until the next report (at most 5 seconds)
- The rate must be reported, although the speed option itself (`PLY-073`) is not built yet
