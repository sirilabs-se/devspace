# Spike: requesting the lowest video quality

**Question:** Can the extension reliably ask YouTube's player for its lowest quality while audio-only
is on, and put the previous quality back afterwards? (`PLY-008`, `SET-024`, `OQ-001`.)

**Date:** 2026-10-10 · **Method:** throwaway scripts run in the page's own context (the content script
cannot reach the player object) on real YouTube, headless Chromium 153, signed out, no extension
loaded. The scripts were not kept.

## Recommendation

**Build `PLY-008` as written, with three adjustments:**

1. Ask for the last non-`auto` entry of `getAvailableQualityLevels()` with `setPlaybackQualityRange(q, q)`.
2. Treat "the quality in use before" as the user's **stored preference** (below), not
   `getPlaybackQuality()`, and keep a copy of it in the extension's own storage.
3. Do nothing, quietly, when the player has no quality levels yet or the method is missing.

It works reliably on ordinary videos. It was not possible to verify live streams, premieres or a
signed-in account here (see "Not verified"), so those need the manual check in task 6.

## What works

| Check | Result |
|---|---|
| Methods present on `#movie_player` | `getAvailableQualityLevels`, `getPlaybackQuality`, `setPlaybackQualityRange`, `setPlaybackQuality`, `getStatsForNerds` all exist |
| Level order | Best first, `auto` last: `hd2160 … hd720, large, medium, small, tiny, auto` (not every video offers every level; the second test video started at `hd1080`) |
| Asking for the lowest | `setPlaybackQualityRange('tiny','tiny')` → `getPlaybackQuality()` becomes `tiny`, the `<video>` element's `videoHeight` becomes 144 and Stats for nerds shows `256x144`, within about 5 s |
| While paused | Works; no need for playback to have started |
| After moving to another video in-page | The request is remembered (see "Side effect"), so the next video already targets 144p. Asking again is harmless |
| Asking again for the same level | Harmless |
| Restoring a manual choice | `setPlaybackQualityRange('hd720','hd720')` → 720p again within about 5 s |
| Restoring Auto | `setPlaybackQualityRange('auto')` → the stored preference becomes Auto and the optimal resolution returns to what Auto would choose |
| `setPlaybackQuality('auto')` | No effect. Do not use it to restore Auto |

## How to tell whether it worked

- Success: after the request, `getPlaybackQuality() === q` (outside ads) and
  `document.querySelector('video').videoHeight` matches (`tiny` → 144, `small` → 240, …).
- Failure shows as silence, not an error: `getAvailableQualityLevels()` returns an empty list or
  `undefined` (the player has not loaded, or YouTube renamed the method), or the quality simply does
  not change. There is no exception to catch, so the extension should check the levels list first and
  treat "no levels" as "nothing to do yet", retrying when the video changes.

## Side effect to design around

YouTube saves every request as the user's own preference in `localStorage['yt-player-quality']`, e.g.
`{"data":"{\"quality\":144,\"previousQuality\":720}", …}`. `quality` is the height in pixels, or `0`
for Auto. That means:

- Asking for the lowest quality **changes the user's saved YouTube setting**, for every later video
  and, if left, for later sessions and for YouTube without the extension.
- The extension must put it back when audio-only turns off, and should keep its own copy of the
  previous value in `chrome.storage.local`, so it can still restore after a browser restart or a
  reload, or when the extension is turned off while audio-only is on.
- `getPlaybackQuality()` is **not** the preference. Under Auto it reports the level Auto picked
  (e.g. `large`); restoring that as a fixed level would silently pin the user to 480p. Read the stored
  preference instead and map the height to a level name: 144 `tiny`, 240 `small`, 360 `medium`,
  480 `large`, 720 `hd720`, 1080 `hd1080`, 1440 `hd1440`, 2160 `hd2160`, `0` or missing → `auto`.
- The storage format is not documented. If it cannot be read, fall back to Auto.

## Ads

An ad played before the second test video. While it played, the player reported quality `unknown`,
and requests were accepted but their effect could not be read from `getPlaybackQuality()`. The
ad's own stream followed the requested range (it went from 240p to 720p when a restore was sent),
so a quality request during an ad also changes the ad's stream. This does not skip, mute or speed up
the ad (`GLB-005`), but the check for "did it work" must be skipped while `#movie_player` has the
class `ad-showing`, and the request should be sent again once the ad is over.

## Not verified

- **Live streams and premieres.** The live stream tried never loaded media in this headless
  environment (no levels, `readyState` 0, no error), so no result. The code must tolerate "no levels".
- **Signed-in accounts.** No account was available. Preference storage may differ (it may also be
  saved to the account).
- **Mini-player and Shorts.**
- **Whether YouTube changes the method names or the storage format.** They are not a public API.

## Decision e (build plan)

"Previous quality" should be read as **the stored preference before audio-only turned on, Auto if it
was Auto or cannot be read**, not the quality playing at that moment. Task 6 follows this.
