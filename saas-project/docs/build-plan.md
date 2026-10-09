# SaaS — Build Plan

| | |
|---|---|
| **Status** | Approved |
| **Last updated** | 2026-10-09 |
| **Design** | [System design](architecture/README.md) |

Each task is a thin slice that works end to end, small enough for one coding session. Don't rewrite tasks that are done; add a new task for follow-up work.

Screens are built to match the UX prototype, `docs/design/event-platform-prototype_v05.html`: its look, layout, states and wording. The design docs decide scope and rules.

Short links used below: [system doc](architecture/README.md), [Identity doc](architecture/modules/identity/README.md), [schema](architecture/database/schema.dbml), [ADRs](architecture/decisions/README.md).

## Decide before the first task starts

- [x] Docker is installed, for the local PostgreSQL.
- [x] Where the `.claude/` folder lives: inside `saas-project/`, with `server.md` updated to `UserId`.

## Decide before the task that needs it

| Decision | Needed by |
|---|---|
| Session length (suggested: 1 day, or 30 days with "remember me") | Task 4 |
| Does a password reset clear a lockout? (suggested: yes) | Task 6 |
| File storage provider, or local disk for now | Task 10 |
| Google and Facebook developer app credentials | Task 11 |
| Email change undo period (suggested: 7 days) | Task 13 |
| Which notification types exist | Task 16 |
| Paging convention for long lists | Task 22 |
| Hosting provider and email service | Task 27 |

## Tasks

| # | Task | Module | Depends on | Status |
|---|---|---|---|---|
| 1 | Project setup | — | — | Done |
| 2 | Sign up | Identity | 1 | Done |
| 2a | Apply the design system | — | 2 | Done |
| 2b | Align sign-up with the design | Identity | 2a | Done |
| 2c | Local email inbox | — | 2b | Done |
| 3 | Verify email and start a session | Identity | 2b | Done |
| 4 | Log in and log out | Identity | 3 | To do |
| 5 | Rate limits and login lockout | Identity | 4 | To do |
| 6 | Forgot and reset password | Identity | 4 | To do |
| 7 | Change password and sign out everywhere | Identity | 4 | To do |
| 8 | Profile basics | Identity | 3 | To do |
| 9 | Change username | Identity | 8 | To do |
| 10 | Avatar upload | Identity | 8 | To do |
| 11 | Google and Facebook sign-in | Identity | 4 | To do |
| 12 | Connected accounts | Identity | 11 | To do |
| 13 | Change email | Identity | 7 | To do |
| 14 | Security activity page | Identity | 4 | To do |
| 15 | Delete account | Identity | 7, 9 | To do |
| 16 | Notification preferences | Identity | 8 | To do |
| 17 | Passkeys | Identity | 4 | To do |
| 18 | Authenticator app and backup codes | Identity | 4 | To do |
| 19 | Email code and trusted devices | Identity | 18 | To do |
| 20 | Active sessions | Identity | 4 | To do |
| 21 | New-device alerts | Identity | 20 | To do |
| 22 | Admin user search | Identity | 4 | To do |
| 23 | Suspend and reinstate | Identity | 22 | To do |
| 24 | Impersonation | Identity | 22 | To do |
| 25 | Admin audit log | Identity | 22 | To do |
| 26 | Download my data | Identity | 14 | To do |
| 27 | First deploy to production | — | 1 | To do |

Statuses: **To do**, **In progress**, **Done**, **Blocked** (say why in the task's notes).

Tasks 2a and 2b were added after the UX prototype arrived; they come before task 3. Phase 1 is tasks 2 to 16, Phase 2 is tasks 17 to 21, Phase 3 is tasks 22 to 26. Task 27 can be done at any point after task 1, once the hosting provider is chosen.

## Task details

### 1. Project setup

**Goal:** An empty app runs locally with every automated check in place, so every later task is built and verified the same way.

**Implements:** [Architecture Checks](architecture/README.md#architecture-checks), [Deployment and Operations](architecture/README.md#deployment-and-operations), [ADR 0001](architecture/decisions/0001-one-app-with-modules.md), [ADR 0002](architecture/decisions/0002-keep-the-design-replaceable.md), [ADR 0004](architecture/decisions/0004-use-postgresql-with-drizzle-in-the-eu.md)

**In scope:**

- SvelteKit 2 project with Svelte 5, TypeScript 6 and `adapter-node`, using the versions in `CLAUDE.md`
- Folder structure from `CLAUDE.md`, including `src/lib/ui/` with `theme.css` (design tokens) and a basic app shell
- ESLint, Prettier, `svelte-check`, Vitest and Playwright
- `dependency-cruiser` rules: modules imported only through `index.ts`, no import loops, `better-auth` only inside Identity, component libraries only inside `src/lib/ui/`, logic tests never importing `.svelte` files or `$lib/ui`
- Stylelint rule: no hard-coded colours, fonts or sizes outside `theme.css`
- One command, `npm run verify`, that runs lint, type checks, the architecture checks and all tests
- CI on GitHub in `devspace/.github/workflows/saas-project.yml`, running `npm run verify` inside `saas-project/` on every push that touches it
- Git hooks: an npm `prepare` script that runs `git config core.hooksPath .githooks`, which git resolves to `devspace/.githooks`
- A `.gitignore` covering `node_modules`, build output and `.env` files
- The Svelte MCP server for the coding agent, set up following the official Svelte docs
- Local PostgreSQL in Docker Compose, the database connection, the migration commands and a first (empty) migration
- An `.env.example` listing every environment variable

**Out of scope:**

- Any feature
- Deploying to production — task 27

**Done when:**

- [x] The app starts locally and shows a placeholder page built from `$lib/ui` components and theme tokens
- [x] `npm run verify` passes locally and in CI
- [x] `npm run verify` fails when a rule is broken on purpose, e.g. importing a module's internal file or hard-coding a colour (then undo the break)
- [x] A commit message containing AI attribution is rejected by the hook
- [x] `npm run db:migrate` runs against the local database

**Notes:**

- `.claude/` is inside `saas-project/`; `.githooks/` is at the `devspace` level and applies to every project in the repository.
- CI fetches the PostgreSQL image from a mirror (`public.ecr.aws/docker/library/postgres`), because GitHub runners are often refused by Docker Hub's download limits.
- The project was written by hand, not with the `sv create` tool, because that tool now sets up SvelteKit 3.
- Logic tests use their own database, `saas_test`, created and migrated automatically, so they never touch development data.
- `npm run verify` also runs the Playwright browser test, which builds the app first. The browser is installed once with `npx playwright install chromium`.
- The import checker reads the `$lib` shortcut from `tsconfig.depcruise.json`. Without it, rules on `$lib/...` imports are silently skipped.
- The "UI libraries only in `src/lib/ui/`" rule works from a list of package names in `.dependency-cruiser.cjs`. A newly approved UI package has to be added to that list.
- The style rule bans fixed lengths (`px`, `rem`, `em`) outside `theme.css`, so every size is a token. Percentages and viewport units are allowed.
- An empty `schema.ts` sits in the Identity folder because the migration tool refuses to run with no schema file.
- Supporting packages added beyond the agreed list: `@eslint/js`, `globals`, `prettier-plugin-svelte`, `postcss-html`, `@types/node`, `@types/pg`.
- Left for later: `npm audit` reports 12 known issues, all in development tools (mostly through `drizzle-kit`), none in code that runs in production. Zod and Better Auth are not installed yet; the tasks that first use them add them.

### 2. Sign up

**Goal:** A person can register with email, password and username, and is sent a verification email.

**Implements:** [Identity doc: Signing up](architecture/modules/identity/README.md#signing-up), [Security and Access](architecture/modules/identity/README.md#security-and-access), [ADR 0003](architecture/decisions/0003-private-data-belongs-to-users.md), [ADR 0005](architecture/decisions/0005-use-better-auth-for-login.md), [ADR 0006](architecture/decisions/0006-one-append-only-audit-log.md)

**In scope:**

- Better Auth set up inside the Identity module, with email and password and usernames
- Tables `users`, `accounts`, `sessions`, `verifications`, `consents`, `audit_events`, including the database rule that rejects edits to `audit_events`
- The `UserId` type and `recordAuditEvent`
- `/signup` page: email, password with a strength meter, username, terms and 18+ confirmation
- `GET /api/username-available`, with the username format rules and the reserved list
- The email helper, with a local version that shows the email in the terminal
- Same "check your email" response whether or not the email is already registered; the existing owner is emailed instead

**Out of scope:**

- Opening the verification link — task 3
- Rate limits — task 5
- Google and Facebook — task 11

**Done when:**

- [x] A new person can fill in `/signup` and sees "check your email"; the email appears locally
- [x] Signing up with an email already in use shows the same message and emails the existing owner
- [x] A password under 10 characters, a taken or reserved username, or unticked terms or 18+ each show a clear error
- [x] Consent records and an audit entry are saved for the new user
- [x] Tests cover the above, and a test proves an `audit_events` row can't be updated

**Notes:**

- The form has no name field, so a new person's name starts as their username. They can change it once the profile page exists (task 8).
- Consent records are saved with version "1" for the terms, the privacy policy and the 18+ confirmation. The documents themselves don't exist yet, so the form's wording has no links.
- The password strength meter is a small guide written in `src/lib/shared/password-strength.ts`, with no extra library. The server alone decides whether a password is accepted.
- The email helper shows emails in the terminal. It refuses to run outside local development unless `EMAIL_TRANSPORT=console` is set, so a missing email service can't go unnoticed in production.
- The whole `users` table is created now, including columns later tasks use (role, suspension, language, time zone), to avoid a string of small migrations.
- The audit log guard is a database trigger added by hand to the end of the generated migration `0001_sign_up.sql`.
- Two new settings are needed in `.env`: `ORIGIN` and `BETTER_AUTH_SECRET`. Both are in `.env.example`.
- Identity's `index.ts` also exports `signUp` and `checkUsernameAvailable` for the pages. They are listed in the Identity doc under "Functions the pages call"; later tasks add their page functions there too.
- Logic test files now run one after another, because they share one database.
- Left for later: the verification link leads to `/verify-email`, which task 3 builds. The username check and sign-up are not rate limited until task 5. If the email already has an account, the answer comes back slightly faster than for a new one; task 5's rate limits reduce what that can reveal.

### 2a. Apply the design system

**Goal:** The app looks like the UX prototype: its tokens, components, sign-up and login layout, and app shell, on desktop and mobile.

**Implements:** [system doc: UX Prototype](architecture/README.md#ux-prototype), [ADR 0002](architecture/decisions/0002-keep-the-design-replaceable.md)

**In scope:**

- `theme.css` rebuilt from the prototype's tokens: colours, type, spacing, corner radii, shadows
- The prototype's fonts, bundled with the app, not loaded from Google's servers
- `$lib/ui` components restyled or replaced to match the prototype: buttons, text fields with a show-password control, checkbox, alerts, cards, headings, text, links, dividers, the large status icon
- The split-screen layout for sign-up and login, and the centred-card layout, with their mobile versions
- The app shell: the prototype's header for signed-out visitors
- The sign-up page and the placeholder page moved onto the new components, with no change to what they do

**Out of scope:**

- Any change to server code, load functions, form actions or logic tests
- Changing sign-up's fields or rules — task 2b
- Screens for features not built yet

**Done when:**

- [x] The sign-up page matches the prototype's "Sign up" screen in layout, type and spacing, on a desktop and a phone-sized window
- [x] Every colour, font, size, radius and shadow comes from `theme.css`; `npm run verify` passes
- [x] No request goes to Google's font servers when a page loads
- [x] No file under `src/lib/server/`, no `+page.server.ts`, `+server.ts` or `*.test.ts` under `src/` was changed

**Notes:**

- The prototype's colours are neutral placeholders; the brand palette is still to come. All status colours (danger, success, warning) are currently the same near-black, as in the prototype.
- The font is Inter Tight, served by the app through the `@fontsource-variable/inter-tight` package (approved by the owner). No page contacts Google.
- Left out on purpose: the "48,000 people host and attend here" line and avatar row on the dark panel, because the number is invented; and the header's "Help" button, because there is no help page.
- The dark panel uses a tokenised gradient in place of the prototype's generated cover images. The third benefit reads "Host your own events, securely", since teams are out of scope.
- The mobile layout switches at a window width of 780 pixels, as in the prototype.
- Links inside `$lib/ui` components take a page of this app and pass it through SvelteKit's path resolver, which the lint rules require. Links to other sites will need their own component when first needed.
- `FormLayout` and `Notice` were replaced by `AuthSplit` and `Alert`. New components: `Icon`, `Logo`, `PageWrap`, `AuthSplit`, `CenteredCard`, `Divider`, `StatusIcon`, `BenefitList`, `TextLink`.
- The browser test now selects the password field by its exact label, because the new show-password button also carries the word "password". What the test checks is unchanged.
- The header shows a "Sign up" button on every page except sign-up. A "Log in" link joins it with task 4.

### 2b. Align sign-up with the design

**Goal:** Sign-up asks for what the prototype shows and follows the rules agreed on 9 October 2026.

**Implements:** [Identity doc: Signing up](architecture/modules/identity/README.md#signing-up), [Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- A required full name field; the name is no longer copied from the username
- Username becomes optional, and may contain dots; it must start and end with a letter or number
- Password rule: at least 8 characters with an upper case letter, a lower case letter, a number and a special character; the page lists each rule and marks it as it is met, replacing the strength bar
- One checkbox for the terms, the privacy policy and being 18 or older; still three consent records
- The prototype's error summary ("Fix 2 things to continue") and field messages
- After a successful sign-up, the prototype's "Check your inbox" screen, showing the email address

**Out of scope:**

- Resending the verification email and the other verification states — task 3
- Google and Facebook buttons — task 11
- The "Already have an account? Log in" link — task 4, when the login page exists
- The bot challenge and the invitation variant in the prototype: not being built

**Done when:**

- [x] Sign-up without a full name shows a clear error
- [x] Sign-up without a username works, and the account has no username
- [x] `maya.okafor` is accepted as a username; `.maya` and `maya.` are not
- [x] A password missing any one of the five rules is refused, and the page shows which rule is unmet
- [x] Unticking the single checkbox blocks sign-up; ticking it saves the terms, privacy and 18+ consent records
- [x] An email that is already registered still gets the same "Check your inbox" screen
- [x] Tests cover the above

**Notes:**

- This changed rules built in task 2. The tests for the old rules were replaced by tests for the new ones; that is a change of requirement, not a weakened check. No database migration was needed.
- The checkbox reads "I am 18 or older and agree to the Terms and Privacy Policy." It has no links yet, because the terms and privacy pages don't exist.
- The password rule lives on the server in `identity/password.ts`. The page's checklist uses a separate copy in `src/lib/shared/password-checklist.ts`, and a test checks that the two always agree.
- As in the prototype, the checklist shows four lines, with upper and lower case as one line, and four bars that fill as lines are met. A space does not count as a special character.
- A password that breaks the rule gets one message naming the whole rule; the checklist shows which part is missing. After a failed attempt the typed password is kept on the page so the checklist stays useful. The server never sends a password back.
- Names are limited to 100 characters.
- "Check your inbox" is shown on the sign-up page itself for now. Task 3 moves it to `/verify-email` and adds the resend and "open email app" buttons.
- The "Log in" link under the form was moved to task 4: links in this app can only point at pages that exist.

### 2c. Local email inbox

**Goal:** While developing, every email the app sends lands in a local inbox that can be read in the browser.

**Implements:** [system doc: Architecture Overview](architecture/README.md#architecture-overview)

**In scope:**

- Mailpit in Docker Compose beside PostgreSQL, started by `npm run db:up`, with its inbox at http://localhost:8025
- The email helper sends over SMTP with `nodemailer`; showing emails in the terminal stays available
- Settings in `.env.example`: `EMAIL_TRANSPORT`, `SMTP_URL`, `EMAIL_FROM`

**Out of scope:**

- Choosing the real email provider — task 27

**Done when:**

- [x] Signing up locally puts the verification email in the Mailpit inbox
- [x] Tests cover sending over SMTP, the terminal mode, an unreachable server and an unknown mode
- [x] `npm run verify` passes

**Notes:** Added at the owner's request on 10 October 2026, with `nodemailer` approved as a new package (plus its type definitions). The automated tests don't need Mailpit: logic tests replace the sender, and browser tests use the terminal mode, so CI is unchanged. If Mailpit isn't running, sending fails with a message saying to run `npm run db:up`. The same SMTP code should work with the real provider by changing `SMTP_URL`.

### 3. Verify email and start a session

**Goal:** A person who opens their verification link is signed in, and pages that need a login are protected.

**Implements:** [Identity doc: Signing up](architecture/modules/identity/README.md#signing-up), [system doc: Cross-Cutting Concerns](architecture/README.md#cross-cutting-concerns)

**In scope:**

- `/verify-email` in the prototype's five states: check your inbox, please wait, verified, link expired, link invalid
- Resending the verification email, at most 3 times per hour, with the prototype's countdown
- "Change email" from the check-your-inbox screen, leading back to sign-up
- `hooks.server.ts`: reads the session, sets `event.locals`, and requires a login for every page outside the public list
- `requireUser`
- A signed-in home page showing the person's name

**Out of scope:**

- The login page — task 4

**Done when:**

- [x] Opening a valid link marks the email verified and lands the person signed in on the home page
- [x] An expired or invalid link shows a clear message and a way to resend; links last 24 hours
- [x] A fourth resend within an hour is refused with the "please wait" screen
- [x] Visiting a protected page while signed out redirects to `/login`
- [x] Tests cover the above, and a test proves one signed-in user can't read another user's account details

**Notes:**

- A valid link shows the prototype's "Email verified" screen, already signed in, with a Continue button to the home page.
- The `rate_limits` table was created here, not in task 5, because the resend limit needs it. Task 5 reuses it.
- The resend limit counts by a scrambled form of the address, for registered and unregistered addresses alike, so it can't be used to find out who has an account and no address is stored in the counter table.
- Between sign-up and "check your inbox", the address is remembered in a short-lived cookie the page's scripts can't read, so it never appears in a URL.
- A link works once: opening a used link shows "This link can't be used" and signs nobody in.
- Left out of the prototype's screens: "Open email app" (a web page can't reliably open one), "Add a passkey" (task 17), and the "Log in" button on the invalid-link screen (task 4, when the page exists).
- After a resend the button waits 60 seconds before it can be pressed again. That pause is on the page only; the limit the server enforces is 3 per hour.
- No page outside the public list exists yet, so the redirect to `/login` is proven by tests of the hook, not by clicking. `/login` itself arrives with task 4.

### 4. Log in and log out

**Goal:** A person can sign in with email and password, stay signed in with "remember me", and sign out.

**Implements:** [Identity doc: Logging in](architecture/modules/identity/README.md#logging-in)

**In scope:**

- The "Already have an account? Log in" link on sign-up, and a "Log in" link in the header
- `/login` page as in the prototype: email first, then the password on a second step, with "remember me" in place of the prototype's "Trust this device"; `/logout`
- The first step answers the same way for every email
- The same generic error for a wrong email, a wrong password and an unverified email
- Session expiry after inactivity and after a maximum age
- Audit entries for successful and failed logins

**Out of scope:**

- Lockout and rate limits — task 5
- The second step — tasks 18 and 19
- The passkey button on the first step — task 17
- Google and Facebook buttons — task 11

**Done when:**

- [ ] A verified person enters their email, then their password, and is signed in; they can sign out
- [ ] Without "remember me" the session ends with the shorter lifetime; with it, the longer one
- [ ] A wrong email and a wrong password give exactly the same response
- [ ] Tests cover the above

**Notes:** Session lengths are an open question in the system doc; settle it before starting.

### 5. Rate limits and login lockout

**Goal:** Repeated sign-up, login and reset attempts are slowed, and repeated failed logins lock the account for a growing time.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Table `rate_limits`
- Rate limits per IP address and per email on sign-up, login and the username check
- Lockout: after 5 failed logins, a wait that doubles from 1 minute up to 15 minutes

**Out of scope:**

- Clearing a lockout through password reset — task 6

**Done when:**

- [ ] The sixth failed login in a row is refused with the generic error, even with the right password, until the wait is over
- [ ] Too many sign-up or username-check requests from one address are refused with a clear message
- [ ] Tests cover the lockout timings and the rate limits

**Notes:** —

### 6. Forgot and reset password

**Goal:** A person who forgot their password can set a new one from an emailed link.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- `/forgot-password`: always shows the same success message; rate limited
- `/reset-password`: single-use link valid for 1 hour (not the prototype's 30 minutes); new password and confirmation fields; sets the password and ends all sessions
- Audit entries for the request and the reset

**Out of scope:**

- Changing a password while signed in — task 7

**Done when:**

- [ ] A registered person receives a link, sets a new password and can sign in with it
- [ ] An unregistered email gets the same on-screen message and no email
- [ ] A used or expired link shows a clear error
- [ ] Tests cover the above

**Notes:** Whether a reset clears a lockout is an open question; settle it before starting.

### 7. Change password and sign out everywhere

**Goal:** A signed-in person can change their password and sign out of all devices.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- `/settings/account`: change password, requiring the current one
- Ending the person's other sessions on a password change
- `/settings/security`: "sign out everywhere"

**Out of scope:**

- Email change and account deletion on the same page — tasks 13 and 15

**Done when:**

- [ ] Changing the password with the correct current password works and signs out other browsers
- [ ] A wrong current password shows a clear error
- [ ] "Sign out everywhere" ends every session, including this one
- [ ] Tests cover the above

**Notes:** —

### 8. Profile basics

**Goal:** A person can edit their name, language and time zone.

**Implements:** [Identity doc: Public Interface](architecture/modules/identity/README.md#public-interface)

**In scope:**

- `/settings/profile`: name, language, time zone
- `getPublicProfiles` and `getContactDetails`

**Out of scope:**

- Username — task 9; avatar — task 10

**Done when:**

- [ ] A person changes their name, language and time zone, and sees them after reloading
- [ ] `getPublicProfiles` returns only name, username and avatar
- [ ] Tests cover the above, and a test proves one user can't change another user's profile

**Notes:** Only English exists; the language setting is stored but changes nothing yet.

### 9. Change username

**Goal:** A person can change their username under the hold rules.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Table `username_holds`
- Username change on `/settings/profile`: once every 30 days; the old name is held for 30 days
- The availability check also refuses held names

**Out of scope:**

- Releasing expired holds — the daily job in task 15

**Done when:**

- [ ] A person with no username can set one
- [ ] A person changes their username and the old one can't be taken by anyone else
- [ ] A second change within 30 days is refused with a clear message
- [ ] Tests cover the above

**Notes:** —

### 10. Avatar upload

**Goal:** A person can upload, replace and remove a profile picture.

**Implements:** [system doc: Architecture Overview](architecture/README.md#architecture-overview)

**In scope:**

- The file storage helper
- Avatar upload on `/settings/profile`, with limits on file type and size

**Out of scope:**

- Any other file uploads

**Done when:**

- [ ] A person uploads a picture and sees it on their profile
- [ ] A file of the wrong type or over the size limit shows a clear error
- [ ] Removing the picture deletes the stored file
- [ ] Tests cover the above

**Notes:** The storage provider is not chosen. Decide before starting whether to use a local-disk version of the helper for now.

### 11. Google and Facebook sign-in

**Goal:** A person can sign up or sign in with Google or Facebook and complete their profile.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access), [ADR 0005](architecture/decisions/0005-use-better-auth-for-login.md)

**In scope:**

- Google and Facebook buttons on `/signup` and `/login`, through `/api/auth/*`
- `/welcome`: accept the terms and confirm 18+ with one checkbox, and optionally pick a username, before using the app
- An email that already has an account is not merged; the person is told to sign in and link the provider from settings

**Out of scope:**

- Linking and unlinking — task 12

**Done when:**

- [ ] A new person signs in with Google, completes `/welcome` and lands on the home page
- [ ] The same works with Facebook
- [ ] Until `/welcome` is completed, every other page redirects to it
- [ ] A provider email matching an existing account does not sign the person in to that account
- [ ] Tests cover the welcome step and the existing-email case

**Notes:** Needs Google and Facebook developer app credentials from the owner.

### 12. Connected accounts

**Goal:** A person can link and unlink Google and Facebook without locking themselves out.

**Implements:** [Identity doc: Module Rules](architecture/modules/identity/README.md#module-rules)

**In scope:**

- `/settings/connections`: list, link and unlink providers
- Refusing to remove the last way to sign in

**Out of scope:**

- Passkeys as a sign-in method — task 17

**Done when:**

- [ ] A person with a password links Google, then signs in with it
- [ ] A person can unlink a provider when another sign-in method remains
- [ ] Unlinking the only sign-in method is refused with a clear message
- [ ] Tests cover the above

**Notes:** —

### 13. Change email

**Goal:** A person can change their email address safely.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Email change on `/settings/account`: the new address must be verified before it takes effect
- A notice to the old address, with a way to undo the change during the grace period
- Audit entries

**Out of scope:**

- Nothing further

**Done when:**

- [ ] The email changes only after the link sent to the new address is opened
- [ ] The old address receives a notice, and can undo the change within the grace period
- [ ] Asking for an address already in use doesn't reveal that it is registered
- [ ] Tests cover the above

**Notes:** The length of the undo period is an open question; settle it before starting.

### 14. Security activity page

**Goal:** A person can see their own security history.

**Implements:** [ADR 0006](architecture/decisions/0006-one-append-only-audit-log.md)

**In scope:**

- The activity list on `/settings/security`: logins, failed logins, password and email changes, with time and device

**Out of scope:**

- The admin view — task 25
- Location

**Done when:**

- [ ] A person sees their recent security events, newest first
- [ ] Tests cover the list, and a test proves one user can't see another user's events

**Notes:** —

### 15. Delete account

**Goal:** A person can delete their account, with 30 days to change their mind before it is permanent.

**Implements:** [Identity doc: Deleting an account](architecture/modules/identity/README.md#deleting-an-account)

**In scope:**

- Delete account on `/settings/account`: sets the deletion date and ends all sessions
- Signing in again within 30 days cancels the deletion
- `POST /api/jobs/daily`, protected by a secret: permanent deletion after 30 days, releasing expired username holds, clearing expired links, deleting audit entries older than 12 months
- On permanent deletion: `onUserDeleted`, holding the username permanently, emptying the user links and device details in `audit_events`

**Out of scope:**

- Scheduling the job in production — task 27

**Done when:**

- [ ] A person asks to delete their account and is signed out everywhere
- [ ] Signing in within 30 days restores the account
- [ ] After 30 days the daily job removes the user and their rows, and the username can't be registered again
- [ ] The job refuses to run without its secret
- [ ] Tests cover the above

**Notes:** —

### 16. Notification preferences

**Goal:** A person can choose what they are notified about.

**Implements:** [Identity doc: Public Interface](architecture/modules/identity/README.md#public-interface)

**In scope:**

- Table `notification_preferences`
- `/settings/notifications`
- `getNotificationPreferences`

**Out of scope:**

- Sending notifications — later modules

**Done when:**

- [ ] A person turns a notification type on or off and the choice is kept
- [ ] Tests cover the above, and a test proves one user can't change another user's preferences

**Notes:** No notification types exist until another module defines one. Leave this task until then, or agree a first type before starting.

### 17. Passkeys

**Goal:** A person can sign in with a passkey instead of a password.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Table `passkeys`
- Adding, naming and removing passkeys on `/settings/security`
- Passkey sign-in on `/login`, with no password and no second step
- Passkeys count as a sign-in method for the "last way to sign in" rule

**Out of scope:**

- Passkey-only sign-up

**Done when:**

- [ ] A person adds a passkey and signs in with it
- [ ] A person removes a passkey, unless it is their last way to sign in
- [ ] Tests cover adding, removing and the last-method rule

**Notes:** —

### 18. Authenticator app and backup codes

**Goal:** A person can add a second step to password login using an authenticator app.

**Implements:** [Identity doc: Logging in](architecture/modules/identity/README.md#logging-in)

**In scope:**

- Table `two_factors`
- Set-up on `/settings/security`: QR code, confirmation code, backup codes shown once
- `/login/two-step`: authenticator code or a backup code
- Regenerating backup codes; turning the second step off

**Out of scope:**

- Email codes and trusted devices — task 19

**Done when:**

- [ ] A person turns on the second step and is asked for a code at the next password login
- [ ] A backup code works once only
- [ ] Regenerating backup codes makes the old ones stop working
- [ ] Tests cover the above

**Notes:** —

### 19. Email code and trusted devices

**Goal:** A person can use a code sent by email as their second step, and can trust a device for 30 days.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Email code as a second-step option on `/login/two-step`, rate limited
- "Trust this device for 30 days"

**Out of scope:**

- Nothing further

**Done when:**

- [ ] A person chooses an email code, receives it and completes login
- [ ] On a trusted device the second step is skipped for 30 days
- [ ] Tests cover the above

**Notes:** —

### 20. Active sessions

**Goal:** A person can see where they are signed in and end any one session.

**Implements:** [system doc: Requirements](architecture/README.md#requirements)

**In scope:**

- The sessions list on `/settings/security`: device, IP address, last active, with the current session marked
- Ending one session

**Out of scope:**

- Location

**Done when:**

- [ ] A person signed in on two browsers sees both, and ending one signs that browser out
- [ ] Tests cover the above, and a test proves one user can't end another user's session

**Notes:** —

### 21. New-device alerts

**Goal:** A person is emailed when their account is signed in to from a device not seen before.

**Implements:** [system doc: Requirements](architecture/README.md#requirements)

**In scope:**

- Recognising a new device at login and emailing the person
- An audit entry for the new-device login

**Out of scope:**

- Location or country

**Done when:**

- [ ] The first login from a new browser sends an alert email; later logins from it don't
- [ ] Tests cover the above

**Notes:** How a device is recognised is not in the design docs; ask before building.

### 22. Admin user search

**Goal:** An admin can find a user and see their account details.

**Implements:** [system doc: Who can do what](architecture/README.md#who-can-do-what)

**In scope:**

- `requireRole`, and the admin check on every `/admin` page
- `/admin/users`: search by email, name or username
- `/admin/users/[id]`: account details and recent security events
- A way to make the first admin without using the app

**Out of scope:**

- Suspending and impersonating — tasks 23 and 24

**Done when:**

- [ ] An admin finds a user by email and opens their details
- [ ] A non-admin who visits any `/admin` page is refused
- [ ] Tests cover the above

**Notes:** The paging convention is an open question; settle it before starting.

### 23. Suspend and reinstate

**Goal:** An admin can suspend a user and reinstate them.

**Implements:** [Identity doc: Security and Access](architecture/modules/identity/README.md#security-and-access)

**In scope:**

- Suspend with a reason, and reinstate, on `/admin/users/[id]`
- Ending the user's sessions on suspension
- Audit entries

**Out of scope:**

- Nothing further

**Done when:**

- [ ] A suspended user is signed out and can't sign in
- [ ] A reinstated user can sign in again
- [ ] Tests cover the above, including that a non-admin can't suspend anyone

**Notes:** —

### 24. Impersonation

**Goal:** An admin can sign in as a user to see what they see, with the user told and every use logged.

**Implements:** [Identity doc: Module Rules](architecture/modules/identity/README.md#module-rules)

**In scope:**

- Start and stop impersonation from `/admin/users/[id]`
- A visible notice while impersonating
- An audit entry and an email to the user
- Blocking password, email and sign-in method changes and account deletion while impersonating

**Out of scope:**

- Nothing further

**Done when:**

- [ ] An admin impersonates a user, sees the app as them, and returns to their own account
- [ ] The user receives an email and the audit log shows who impersonated whom
- [ ] While impersonating, the blocked actions are refused
- [ ] Tests cover the above

**Notes:** —

### 25. Admin audit log

**Goal:** An admin can view and export the audit log.

**Implements:** [ADR 0006](architecture/decisions/0006-one-append-only-audit-log.md)

**In scope:**

- `/admin/audit`: list with filters by user, action and date
- Export of the filtered list as a file

**Out of scope:**

- Editing or deleting entries

**Done when:**

- [ ] An admin filters the log and downloads the result
- [ ] A non-admin is refused
- [ ] Tests cover the above

**Notes:** —

### 26. Download my data

**Goal:** A person can download the data held about them and see which terms they accepted.

**Implements:** [system doc: Requirements](architecture/README.md#requirements)

**In scope:**

- `/settings/privacy`: accepted terms and privacy policy versions, and "download my data"
- An export of Identity's own data about the person

**Out of scope:**

- Other modules' data

**Done when:**

- [ ] A person downloads a file containing their profile, sign-in methods (without secrets), consents, preferences and security events
- [ ] The file contains no password hashes, tokens or secrets
- [ ] Tests cover the above, and a test proves one user can't download another user's data

**Notes:** —

### 27. First deploy to production

**Goal:** The app is live at a production address in the EU, and every later change ships through the same deploy process.

**Implements:** [Deployment and Operations](architecture/README.md#deployment-and-operations), [Hosting and Cost](architecture/README.md#hosting-and-cost)

**In scope:**

- The app, database, file storage and email service at the chosen EU provider, with `saas-project` as the root directory
- Environment variables and secrets on the hosting platform
- Migrations running on deploy
- The daily job scheduled, if task 15 is done
- Daily database backups

**Out of scope:**

- Any feature

**Done when:**

- [ ] The app is live at the production address
- [ ] A push to the main branch deploys only after `npm run verify` passes in CI
- [ ] A real email is delivered from production
- [ ] A database backup exists and a restore has been tried once

**Notes:** The owner chose to build locally first. This task needs the hosting provider, email service and file storage chosen.
