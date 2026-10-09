# Task Status

One section per build-plan task, added when the task is finished. Each says what changed, how to try it, what was decided, and what was left for later. The plan itself is in [`build-plan.md`](build-plan.md).

**To try anything below:** in `saas-project/`, run `npm install`, `npm run db:up`, `npm run db:migrate` and `npm run dev`. The app is at http://localhost:5173 and the local inbox, where every email the app sends appears, is at http://localhost:8025.

## Task 3: Verify email and start a session

**Status:** Done. `npm run verify` passes (88 logic tests, 7 browser tests).

**What changed**

- `src/hooks.server.ts`: works out who is signed in from the session cookie, and sends signed-out visitors to `/login` for any page outside the public list.
- `src/lib/server/public-paths.ts`: the public list.
- `src/lib/server/pending-email.ts`: remembers the address between sign-up and "check your inbox".
- `src/lib/server/modules/identity/`: `session.ts` (who is signed in, `requireUser`), `verify-email.ts` (open a link, resend), `rate-limit.ts` (attempt counter), and the `rate_limits` table in `schema.ts`.
- `migrations/0002_rate_limits.sql`: the new table.
- `src/routes/verify-email/`: the page in its five states, and the resend action.
- `src/routes/signup/`: a successful sign-up now moves on to `/verify-email`.
- `src/routes/+layout.server.ts`, `+layout.svelte`, `+page.svelte`: the header shows the signed-in person's name, and the home page greets them.
- `src/lib/ui/Icon.svelte`: three more icons.
- Tests next to each of the above, plus `tests/setup/accounts.ts` (helpers that create accounts for tests) and `tests/e2e/verify-email.test.ts`.

**Try it**

1. Open http://localhost:5173/signup and create an account.
2. You land on "Check your inbox", showing your address. Press "Resend email" and watch the one-minute countdown.
3. Open http://localhost:8025, open the email and click its link.
4. You see "Email verified". Press Continue: the home page says "Welcome, <your name>" and the header shows your name.
5. Click the same link again: "This link can't be used".
6. Press "Resend email" four times within an hour (reload between presses to skip the pause): the fourth shows "Please wait a moment".

**Decisions**

- A valid link shows the "Email verified" screen, already signed in, with a Continue button, as in the prototype.
- The `rate_limits` table was created now, not in task 5, because the resend limit needs it.
- The resend limit counts every address the same way, registered or not, so it can't reveal who has an account.
- The address is carried from sign-up in a cookie, not in the URL.
- A used link signs nobody in.

**SHOULD rules deviated from:** none.

**Left for later**

- "Open email app" and "Add a passkey" buttons from the prototype are not there. The first can't be done reliably from a web page; the second belongs to task 17.
- The "Log in" button on the invalid-link screen, and the page that signed-out visitors are sent to, arrive with task 4.
- There is no way to sign out or sign back in yet; that is task 4. To get back to a signed-out state now, clear the site's cookies.

## Task 4: Log in and log out

**Status:** Done. `npm run verify` passes (111 logic tests, 10 browser tests).

**What changed**

- `src/lib/server/modules/identity/log-in.ts`: `logIn` and `logOut`.
- `src/lib/server/modules/identity/auth.ts` and `session.ts`: session lengths, and the 90-day maximum.
- `src/lib/server/next-path.ts`: decides where to go after login.
- `src/hooks.server.ts`: remembers the page a signed-out visitor was heading for.
- `src/routes/login/`: the two-step login page and its actions.
- `src/routes/logout/`: the sign-out action.
- `src/routes/+layout.svelte`: "Log in" and "Sign up" in the header when signed out; the name and "Log out" when signed in.
- `src/routes/signup/` and `verify-email/`: the "Log in" links that were waiting for this page.
- `src/lib/ui/AccountChip.svelte`: the row showing which email is signing in.
- Tests beside each, plus `tests/e2e/login.test.ts`, which runs the whole journey from sign-up to logging back in.

**Try it**

1. Sign up and verify as in task 3, then press "Log out" in the header.
2. Press "Log in", enter your email, then your password on the next step.
3. Try a wrong password: "That email and password didn't work". Try an email that has no account: the same step and the same message.
4. Sign up with a second address but don't verify it, then log in with it: "Verify your email to continue".
5. Tick "Remember me" when logging in, close the browser and reopen it: you are still signed in. Without it, you are signed out.

**Decisions**

- You chose the prototype's "Verify your email" screen for an unverified email with a correct password.
- Session lengths: 1 day, or 30 days with "remember me", and never more than 90 days. The first two were the suggested defaults; the 90 days is mine. Please confirm or change them.
- After login, people return to the page they were heading for, limited to pages inside the app.
- Logging out needs a submitted form.

**SHOULD rules deviated from:** none.

**Left for later**

- The passkey, Google, Facebook and "Forgot password?" parts of the prototype's login screen arrive with tasks 17, 11 and 6.
- Repeated wrong passwords are not slowed down yet; that is task 5.

## Task 5: Rate limits and login lockout

**Status:** Done. `npm run verify` passes (127 logic tests, 10 browser tests).

**What changed**

- `src/lib/server/modules/identity/lockout.ts`: counts failed logins per email and works out the wait.
- `src/lib/server/modules/identity/request-limits.ts`: the named limits and their numbers.
- `log-in.ts` and `sign-up.ts`: apply the lockout and the limits.
- `src/routes/api/username-available/+server.ts`: refuses with "too many checks" past the limit.
- `src/routes/login/` and `signup/`: the "Sign-in paused" and "Too many attempts" messages with a countdown.
- `src/lib/ui/Countdown.svelte`: a minutes-and-seconds countdown.
- `tests/setup/e2e-global-setup.ts`: empties the test database before browser tests.
- New and extended tests beside each.

**Try it**

1. Log in with a wrong password five times. The sixth attempt fails even with the right password.
2. Wait one minute and log in with the right password: it works.
3. To see "Sign-in paused", make 30 login attempts within 15 minutes.
4. To see the sign-up limit, submit the sign-up form 11 times within an hour with different emails.
5. To start again, clear the counters: `docker exec saas-project-db-1 psql -U saas -d saas -c "truncate rate_limits"`.

**Decisions**

- I chose the limit numbers, since the design gives none: 10 sign-ups an hour and 30 logins per 15 minutes per network address, 60 username checks a minute, 5 sign-ups an hour per email.
- A lockout answers exactly like a wrong password, as the task says. The prototype's "Sign-in paused" screen is used only for the per-network limit.
- Attempts during a lockout aren't counted.
- Failures are forgotten after a quiet day.

**SHOULD rules deviated from:** none.

**Left for later**

- If you would prefer the prototype's "Sign-in paused" screen for a locked-out email too, it is safe to show, because it would appear for every email, registered or not. It is a small change; say the word.
- In production, the app must be told which header carries the visitor's real address (task 27).
