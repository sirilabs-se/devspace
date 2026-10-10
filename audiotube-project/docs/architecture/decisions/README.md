# Decision Log

This folder records important design decisions as ADRs (Architecture Decision Records): short notes explaining what was decided and why. Each ADR's **Scope** says whether it affects the whole extension or one module.

## When to write an ADR

Write one only for decisions that would be costly to change later, such as where state lives, how the parts of the extension talk to each other, or how the extension reaches YouTube. Small, easily reversed choices don't need one. Temporary choices for one phase belong in that phase's build plan.

## How to add one

1. Copy [`0000-template.md`](0000-template.md) to the next unused number, e.g. `0007-store-video-records-once.md` (lowercase, words joined by hyphens).
2. Fill it in, including the scope and status.
3. Add a row to the table below, and add each MUST to the Architecture Checks table in [`../../architecture.md`](../../architecture.md).

## Changing a decision

Don't rewrite the decision in an accepted ADR. Instead:

1. Write a new ADR for the new decision, and fill in its **Supersedes** field.
2. In the old ADR, change only the status to "Superseded by NNNN".
3. Update both rows in the table below.

Fixing typos or broken links in an old ADR is fine.

## Statuses

| Status | Meaning |
|---|---|
| Proposed | Under discussion, not decided yet |
| Accepted | Decided and in effect |
| Superseded | Replaced by a later ADR |
| Rejected | Considered and decided against |

## Decisions

| # | Title | Scope | Status | Date |
|---|---|---|---|---|
| [0001](0001-background-is-the-only-writer.md) | The background service worker is the only writer of stored state | System | Accepted | 2026-10-10 |
| [0002](0002-keep-the-side-panel-design-replaceable.md) | Keep the side panel design replaceable | Side panel | Accepted | 2026-10-10 |
| [0003](0003-state-lives-in-storage.md) | State lives in `chrome.storage`, never only in the service worker's memory | System | Accepted | 2026-10-10 |
| [0004](0004-reach-youtube-player-through-the-page-script.md) | Reach YouTube's player only through the page script | Content, page script | Accepted | 2026-10-10 |
| [0005](0005-latest-tab-to-play-is-the-playback-tab.md) | The latest tab to start playing is the playback tab | System | Accepted | 2026-10-10 |
| [0006](0006-overlay-on-every-youtube-tab.md) | The overlay covers every YouTube tab, not only the playback tab | Content | Accepted | 2026-10-10 |
| [0007](0007-side-panel-counts-progress-forward.md) | The side panel counts progress forward between reports | Side panel, background, page script | Accepted | 2026-10-11 |
