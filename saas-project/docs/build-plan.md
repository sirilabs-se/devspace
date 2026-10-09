# [App Name] — Build Plan

<!--
How to use this template:
- Each task is a thin slice that works end to end (screen, API and database),
  so it can be tested and shown on its own.
- Keep each task small enough for one coding-agent session.
- Order: project setup and first deploy, then the slice everything else depends on
  (usually sign-up and login), then features.
- Don't rewrite tasks that are done. Add a new task for follow-up work.
- The first task that stores customer data MUST include a test proving one company can't
  read or change another company's data.
- Replace everything in [square brackets]. The example tasks are placeholders.
-->

| | |
|---|---|
| **Status** | Draft / Approved |
| **Last updated** | YYYY-MM-DD |
| **Design** | [System design](architecture/README.md) |

## Tasks

| # | Task | Module | Depends on | Status |
|---|---|---|---|---|
| 1 | Project setup and first deploy | — | — | To do |
| 2 | [e.g. Company sign-up and login] | [e.g. Identity] | 1 | To do |
| 3 | [e.g. Invite team members] | [e.g. Identity] | 2 | To do |
| 4 | [e.g. Start a free trial on sign-up] | [e.g. Billing] | 2 | To do |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

## Task details

### 1. Project setup and first deploy

**Goal:** An empty app runs locally and is live in production, so every later task ships through the real deploy process from day one.

**Implements:** [Deployment and Operations](architecture/README.md#deployment-and-operations), [the replaceable design ADR](architecture/decisions/README.md)

**In scope:**

- SvelteKit project with Svelte 5 and TypeScript, using the versions agreed in the plan
- Folder structure from `CLAUDE.md`, including `src/lib/ui/` with `theme.css` (design tokens) and a basic app shell
- Linting, type checking and the test runner
- Automated checks for every rule the system doc's Architecture Checks table marks as Lint, Type check or Test
- One command, `npm run verify`, that runs lint, type checks, the architecture checks and all tests
- CI on GitHub that runs `npm run verify` on every push
- Git hooks: an npm `prepare` script that runs `git config core.hooksPath .githooks`, so the commit-msg hook is on for every clone
- The Svelte MCP server for the coding agent, set up following the official Svelte docs
- Database connection and the first migration
- Deploy process and environment variables

**Out of scope:**

- Any feature

**Done when:**

- [ ] The app starts locally and shows a placeholder page built from `$lib/ui` components and theme tokens
- [ ] `npm run verify` passes locally and in CI
- [ ] `npm run verify` fails when a rule is broken on purpose, e.g. importing a module's internal file or hard-coding a colour (then undo the break)
- [ ] A commit message containing AI attribution is rejected by the hook
- [ ] The app is live at the production address

**Notes:** —

### 2. [Task name]

**Goal:** [What a user can do when this is finished, in one sentence.]

**Implements:** [Links to the design doc sections and ADRs this task builds, e.g. the Identity module doc, ADR 0002]

**In scope:**

- [e.g. Sign-up page and API endpoint]
- [e.g. companies and users tables]

**Out of scope:**

- [e.g. Password reset — task 5]

**Done when:**

- [ ] [A check anyone can verify, e.g. a new company can sign up and lands on the dashboard]
- [ ] [e.g. Signing up with an email already in use shows a clear error]
- [ ] [e.g. Tests cover sign-up success and the duplicate email case]

**Notes:** [Anything decided while building, or why the task is blocked]
