# AudioTube

AudioTube is a Chrome extension that plays YouTube videos audio-only in the background, with a Queue, Playlists and Settings, for anyone who wants to listen to YouTube like a podcast rather than watch it.

## Design docs

The design docs are the source of truth. Read the ones that apply before changing code.

| Doc | Read when |
|---|---|
| `docs/audiotube_requirements.md` | Always: the functional requirements (`GLB-`/`PLY-`/`QUE-`/`PLS-`/`SET-`/`OQ-`/`NG-` IDs) every feature must satisfy |
| `docs/tech-stack.md` | Always: the chosen stack and why |
| `docs/architecture.md` | Before structuring code: module boundaries, state ownership, the messaging protocol between contexts |
| `docs/build-plan.md` | Picking up or finishing a task |

## Tech stack

See `docs/tech-stack.md` for the full picture and reasoning. Summary:

| Context | Choice |
|---|---|
| Side panel UI | TypeScript, Svelte, Tailwind CSS |
| Content script / inject script / background | TypeScript, no framework |
| Build | Vite + a Chrome-extension plugin |
| Storage | `chrome.storage.local` only (no server, no database) |
| Tests | Not yet decided |

## Commands

```bash
npm install           # install dependencies (also turns on the repo's git hooks)
npm run dev            # build the extension in watch mode, for loading via chrome://extensions
npm run build          # production build
npm test               # run all tests
npm run lint           # check code style
npm run check          # type-check and svelte-check
npm run verify         # run every check: lint, types, architecture rules, tests
```

## Folder structure

Proposed — confirm against `docs/architecture.md` once it exists.

```text
extension/
├── src/
│   ├── background/          ← service worker: owns Now Playing, the Queue, the Previous
│   │                           record, and which tab is the playback tab
│   ├── content/             ← isolated-world content script injected into youtube.com
│   ├── inject/              ← page-context script — the only code that can reach
│   │                           YouTube's own internal player object
│   ├── sidepanel/
│   │   ├── core/            ← business logic: state, messaging, use of the settings read helper
│   │   │                       (no Svelte imports — the replaceable-design boundary)
│   │   ├── ui/               ← Svelte components, theme.css design tokens, icon set
│   │   │                       (replaceable)
│   │   └── index.html
│   └── shared/               ← types and small utilities safe for every context,
│                                 no business logic; also the settings schema and the
│                                 settings read helper (the only code that reads storage)
└── public/
    ├── manifest.json
    └── icons/
```

## How to read the rules

- **MUST** / **MUST NOT**: a hard rule. Breaking it is a defect, never a judgment call. If a MUST blocks a task, stop and explain.
- **SHOULD**: the default. Deviate only with a reason, and give the reason in your report.
- **MAY**: allowed. Your choice.

Each MUST ends with what checks it, in brackets. `npm run verify` runs every automated check.

## Rules

### Modules

- A module's public API is exactly what its `index.ts` exports. Other code MUST import a module only through its `index.ts`. [lint]
- Modules MUST NOT import each other in a loop. [lint]
- A module MUST NOT read or write another module's state directly. Call its public API instead. [review]
- If a task needs something new from another module, you SHOULD add it to that module's public API.
- A module MAY organise its internal files however it likes.

### Local-only data

- All user data — playlists, the Queue, the Previous record, settings, the custom cover image — MUST stay on the device (`GLB-011`). [review]
- Nothing about what the user listens to MUST be sent anywhere off the device. The only data that ever leaves the device is a playlist the user explicitly exports (`GLB-012`). [review]
- No analytics, telemetry or crash reporting MUST transmit browsing or listening activity off-device. [review]

### Replaceable design

The app's look (colours, components, layout) must be replaceable with a new design without changing business logic, state or screen behaviour. This applies to the **side panel only** — the content script's overlay has no real "design" to swap, and the background service worker has no UI at all. The test: replacing `sidepanel/ui/` and its theme tokens must not require changing anything in `sidepanel/core/`, the background service worker, the content script, or any non-UI test.

- Only `background/` MUST write to `chrome.storage` (set, remove, clear). [lint]
- Reading stored values MUST go through the settings read helper in `shared/` (keys, defaults, validation, change events). `sidepanel/core/` and `content/` MAY use it; `.svelte` files MUST NOT touch storage. [lint]
- Business rules and validation other than the settings schema MUST live only in `sidepanel/core/` or `background/`, never in `.svelte` files. [review]
- `sidepanel/core/` MUST NOT import from `sidepanel/ui/`, and MUST NOT contain Svelte components. [lint]
- Colours, fonts, spacing, corner radii and shadows MUST come from design tokens in `sidepanel/ui/theme.css`. [lint]
- A component library, icon set or CSS framework MUST be imported only inside `sidepanel/ui/`. [lint]
- Logic tests MUST NOT import `.svelte` files or anything from `sidepanel/ui/`. [lint]
- `sidepanel/ui/` component props SHOULD be named by meaning, not appearance: `variant="danger"`, not `color="red"`.
- Svelte components in `sidepanel/ui/` SHOULD stay presentational, calling into `sidepanel/core/` for all state and behaviour.

### No AI attribution

- You MUST NOT add attribution to any AI agent, anywhere in this repository: no `Co-Authored-By` trailer, no "Generated with" or "written by" line, no AI byline or mention in commit messages, PR descriptions, code comments, docs, or any other file. [git hook, review]
- Commit messages and PR descriptions MUST read as if the human author wrote them alone. [review]
- If the commit-msg hook (`.githooks/commit-msg`) rejects a commit, fix the message. You MUST NOT bypass the hook. [review]

### Code

- Follow the patterns already in the code before inventing new ones (SHOULD).
- Files in kebab-case; Svelte components in PascalCase (SHOULD).
- Messages passed between the background, content, inject and side panel contexts MUST be typed as a discriminated union, never an untyped object. [type check]
- Domain errors (for example, a video that's unavailable vs. one that temporarily failed to load) SHOULD use typed error codes, matching the Unavailable/Unknown distinction in `PLY-107` to `PLY-109`.
- Store timestamps as epoch milliseconds; convert only for display (SHOULD).

### Tests

- `npm run verify` (lint, type check, architecture rules and tests) MUST pass before a task is done. [CI]
- Tests live next to the code as `*.test.ts` (SHOULD).
- Test framework is not yet decided — see `docs/tech-stack.md`.
- Every module's public function and every cross-context message handler SHOULD have a test.

### Ask before you

- Add a new dependency (library or service).
- Do anything that contradicts `docs/audiotube_requirements.md`, `docs/tech-stack.md`, or `docs/architecture.md`. Stop and explain the conflict instead.
- Change the manifest's permissions or host permissions, CI, `.claude/settings.json`, `.claude/rules/` or `.githooks/`.

### Never

These are MUST NOTs for every task:

- Commit secrets (API keys, passwords). Use environment variables. [review]
- Delete, skip or weaken a test, a lint rule or a check to make it pass. [review]
- Bypass git hooks (for example with `--no-verify`). [review]
- Work on more than one build-plan task at a time.

## Definition of done

A task is done only when all of these are true:

- [ ] Every "Done when" check for the task in `docs/build-plan.md` passes
- [ ] `npm run verify` passes
- [ ] Design docs are updated if anything about the design changed (with my approval)
- [ ] Any SHOULD you deviated from is listed in your report, with the reason
- [ ] The task's status is updated in `docs/build-plan.md`
