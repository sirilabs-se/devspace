# [App Name]

<!--
How to use this template:
- This file sits at the root of the repo. The coding agent reads it at the start of every session.
- Keep it under 200 lines (the recommended limit), because all of it loads into every session.
  HTML comments like this one are removed before the agent sees the file, so they cost nothing.
- Point to the design docs instead of copying them. Paths are written in `backticks`
  on purpose: the agent reads them when needed instead of loading them every session.
- Replace everything in [square brackets]. Delete sections that don't apply.
- Keep the "Replaceable design" and "No AI attribution" sections for every project.
- Keep the MUST / SHOULD / MAY wording, and the [check] after each MUST: it says what catches a violation.
-->

[One or two sentences: what the app is and who uses it.]

## Design docs

The design docs are the source of truth. Read the ones that apply before changing code.

| Doc | Read when |
|---|---|
| `docs/architecture/README.md` | Always: overall design, API conventions, rules every module follows |
| `docs/architecture/modules/<name>/README.md` | Working inside that module |
| `docs/architecture/database/schema.dbml` | Changing the database |
| `docs/architecture/decisions/README.md` | Before changing anything a decision covers |
| `docs/build-plan.md` | Picking up or finishing a task |

## Tech stack

| Part | Choice | Version |
|---|---|---|
| Framework | SvelteKit | [e.g. 3.x] |
| UI | Svelte | [e.g. 5.x] |
| Language | TypeScript | [e.g. 6.x] |
| Database | [e.g. PostgreSQL] | [e.g. 17] |
| Tests | [e.g. Vitest, Playwright] | |

## Commands

```bash
[npm install]           # install dependencies (also turns on the repo's git hooks)
[npm run dev]           # run the app locally
[npm test]              # run all tests
[npm run lint]          # check code style
[npm run check]         # check types and Svelte code
npm run verify          # run every check: lint, types, architecture rules, tests
[npm run db:migrate]    # apply database migrations
```

## Folder structure

```text
[src/
├── lib/
│   ├── server/             ← server only: business logic, validation, database
│   │   ├── modules/
│   │   │   └── identity/
│   │   │       ├── index.ts   ← public interface: the only file other modules import
│   │   │       └── ...        ← internal, never imported from outside the module
│   │   └── db/
│   ├── ui/                 ← the design: components and theme.css (replaceable)
│   └── shared/             ← small utilities safe for the browser, no business logic
├── routes/                 ← pages, load functions, form actions (thin)
│   └── +layout.svelte      ← app shell (replaceable)]
```

## How to read the rules

- **MUST** / **MUST NOT**: a hard rule. Breaking it is a defect, never a judgment call. If a MUST blocks a task, stop and explain.
- **SHOULD**: the default. Deviate only with a reason, and give the reason in your report.
- **MAY**: allowed. Your choice.

Each MUST ends with what checks it, in brackets. `npm run verify` runs every automated check.

## Rules

### Modules

<!-- Delete this section for an app without modules. Details: .claude/rules/server.md -->

- A module's public API is exactly what its `index.ts` exports. Other code MUST import a module only through its `index.ts`. [lint]
- Modules MUST NOT import each other in a loop. [lint]
- A module MUST NOT read or write another module's tables. Call its public API instead. [review]
- If a task needs something new from another module, you SHOULD add it to that module's public API and update its module doc.
- A module MAY organise its internal files however it likes.

### Customer data

<!-- Delete this section if the app doesn't keep several customers' data apart. -->

- Every server function that reads or writes customer data MUST take a `CompanyId` parameter and limit its queries to that company. [type check]
- The current company MUST come from `event.locals` (set in `hooks.server.ts`) and be passed down explicitly. It MUST NOT come from global state or straight from request input. [review]
- Every feature that stores customer data MUST have a test proving one company can't read or change another company's data. [test]

### Replaceable design

The app's look (colours, components, layout) must be replaceable with a new design without changing business logic, data or screen behaviour. The test: replacing `src/lib/ui/`, the theme file and the app shell (`src/routes/+layout.svelte`) must not require changing any server code, load function, form action, or non-UI test.

- Business rules, validation, permissions and database access MUST live only in `src/lib/server/`, never in `.svelte` files. [review]
- Load functions and form actions MUST only call server code and return plain data, never styling (CSS classes, colours, icon names). [review]
- Colours, fonts, spacing, corner radii and shadows MUST come from design tokens in `src/lib/ui/theme.css`. [lint]
- A component library, icon set or CSS framework MUST be imported only inside `src/lib/ui/`. [lint]
- Logic tests MUST NOT import `.svelte` files or `$lib/ui`. [lint]
- `$lib/ui` component props SHOULD be named by meaning, not appearance: `variant="danger"`, not `color="red"`.
- Pages SHOULD build screens from `$lib/ui` components, with no styling beyond simple arrangement.

### No AI attribution

- You MUST NOT add attribution to any AI agent, anywhere in this repository: no `Co-Authored-By` trailer, no "Generated with" or "written by" line, no AI byline or mention in commit messages, PR descriptions, code comments, docs, or any other file. [git hook, review]
- Commit messages and PR descriptions MUST read as if the human author wrote them alone. [review]
- If the commit-msg hook (`.githooks/commit-msg`) rejects a commit, fix the message. You MUST NOT bypass the hook. [review]

### Database

- The database MUST change only through migration files in `[migrations/]`. [review]
- A migration that has already been applied MUST NOT be edited. Write a new one. [review]
- `docs/architecture/database/schema.dbml` MUST be updated in the same commit as the migration. [review]
- Changes that delete or rename existing data MUST be approved by me first. [review]
- Each task SHOULD add at most one migration.

### Code

- Follow the patterns already in the code before inventing new ones (SHOULD).
- Svelte rules are in `.claude/rules/svelte.md`; server rules in `.claude/rules/server.md`. Both load automatically for matching files.
- [Naming, e.g. files in kebab-case, Svelte components in PascalCase (SHOULD)]
- [Errors, e.g. domain errors use typed error codes from the shared error format (SHOULD)]
- [Validation, e.g. all input to form actions and API routes MUST be validated with Zod [review]]
- [Dates, e.g. store in UTC, convert only for display (SHOULD)]

### Tests

- `npm run verify` (lint, type check, architecture rules and tests) MUST pass before a task is done. [CI]
- [Where tests live, e.g. next to the code as `*.test.ts`]
- [What MUST be tested, e.g. every form action, API route and public module function]

### Ask before you

- Add a new dependency (library or service).
- Do anything that contradicts the design docs or an ADR. Stop and explain the conflict instead.
- Change [e.g. deployment settings], CI, `.claude/settings.json`, `.claude/rules/` or `.githooks/`.

### Never

These are MUST NOTs for every task:

- Commit secrets (API keys, passwords). Use environment variables. [review]
- Delete, skip or weaken a test, a lint rule or a check to make it pass. [review]
- Bypass git hooks (for example with `--no-verify`). [review]
- Work on more than one build plan task at a time.

## Definition of done

A task is done only when all of these are true:

- [ ] Every "Done when" check for the task in `docs/build-plan.md` passes
- [ ] `npm run verify` passes
- [ ] Design docs are updated if anything about the design changed (with my approval)
- [ ] Any SHOULD you deviated from is listed in your report, with the reason
- [ ] The task's status is updated in `docs/build-plan.md`
