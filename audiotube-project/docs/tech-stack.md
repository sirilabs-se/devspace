# AudioTube — Tech Stack

Decided 2026-10-08. This covers the three runtime contexts a Chrome MV3 extension actually
has — they don't share one stack, because they don't share one set of constraints.

## Side panel UI

| Part | Choice |
|---|---|
| Language | TypeScript |
| Framework | Svelte |
| Styling | Tailwind CSS |
| Build | Vite 8, via `@crxjs/vite-plugin` (chosen 2026-10-10 over `vite-plugin-web-extension`) |

**Why a framework here, specifically Svelte:**
- The requirements doc repeatedly requires one value to stay in sync across multiple controls
  (`PLY-005`, `SET-063`, the Autoplay toggle appearing in both Settings and the Player's More
  panel) — exactly what a reactive framework guarantees by construction and hand-rolled DOM
  code gets wrong under edit pressure.
- Multiple side panel windows can be open at once and must share live state (`GLB-013`,
  `GLB-014`, `QUE-128`) — cross-instance reactivity, not just local component state.
- Svelte compiles away its runtime, which matters for extension bundle size and store review.
- First-class Tailwind integration; additive to the chosen styling approach, not competing
  with it.

## Content script (injected into youtube.com)

| Part | Choice |
|---|---|
| Language | TypeScript |
| Framework | None — vanilla DOM APIs |
| Styling | Plain CSS (injected, scoped to the extension's own elements) |

Runs inside YouTube's own page, alongside YouTube's own app. Needs to be small, fast to
inject, and unable to collide with YouTube's own scripts or styles. A framework runtime here
is pure downside with no corresponding benefit — this surface is one overlay and a handful of
injected buttons (`PC-301` to `PC-602`), not an application.

## Background / service worker

| Part | Choice |
|---|---|
| Language | TypeScript |
| Framework | None |

Pure message-passing and storage logic — owns the single source of truth for Now Playing, the
Queue, the Previous record, and which tab is the playback tab (`GLB-001`, `PLY-039`). Nothing
here renders, so a UI framework has nothing to do.

## Storage

`chrome.storage.local` only. `PLS-024` explicitly rules out requesting the `unlimitedStorage`
permission, so the ~10 MB quota is a real constraint, not a default to revisit casually.

## Tests

| Part | Choice |
|---|---|
| Logic | Vitest, tests next to the code as `*.test.ts` |
| Browser | Playwright with the built extension loaded in Chromium; a local test page stands in for YouTube's watch page, served at a `www.youtube.com` address through request routing |
| Lint and rules | ESLint, Prettier, Stylelint (side panel), dependency-cruiser (import rules); `npm run verify` runs everything |

## Not yet decided

- Exact messaging protocol between content script ⟷ background ⟷ side panel.
- Project/module folder layout.
- Data model for the shared video record, Queue entries, and Playlists (`PLS-073` to `PLS-081`).

These are architecture questions, not tech-stack questions — tracked separately.
