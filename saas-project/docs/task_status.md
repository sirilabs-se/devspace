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

## Task 6: Forgot and reset password

**Status:** Done. `npm run verify` passes (147 logic tests, 12 browser tests).

**What changed**

- `src/lib/server/modules/identity/password-reset.ts`: request a link, check a link, set the new password.
- `identity/emails.ts`: the reset email and the "password was changed" email.
- `identity/auth.ts` and `request-limits.ts`: 1-hour links, sessions ended on reset, and the request limits.
- `src/routes/forgot-password/` and `src/routes/reset-password/`: the two pages.
- `src/routes/login/+page.svelte`: "Forgot password?" on the password step and "Reset password instead" on the paused screen.
- `src/lib/shared/password-checklist.ts`: the checklist wording, now shared with sign-up.
- Tests beside each, plus `tests/e2e/password-reset.test.ts`.

**Try it**

1. On the login page, enter your email, then press "Forgot password?".
2. Enter your email and press "Send reset link". You see "Check your email".
3. Open http://localhost:8025, open the email and click the link.
4. Type a new password twice and press "Update password". You see "Password updated".
5. Log in with the new password. The old one no longer works, and any other browser you were signed in on is signed out.
6. Click the link in the email again: "This reset link can't be used".
7. Try step 2 with an address that has no account: the same screen, and no email arrives.

**Decisions**

- A reset clears a login lockout (the suggested default). Please confirm.
- Two dead-link screens, not the prototype's three, because a used link can't be told apart from a mistyped one.
- Limits of 3 requests an hour per email and 10 per network address.
- A confirmation email is sent after a reset.

**SHOULD rules deviated from:** none.

**Left for later**

- Nothing in this task. The breached-password warning and the "This wasn't me" recovery path in the prototype are out of scope.

## Task 7: Change password and sign out everywhere

**Status:** Done. `npm run verify` passes (161 logic tests, 14 browser tests).

**What changed**

- `src/lib/server/modules/identity/change-password.ts`: `changePassword` and `signOutEverywhere`.
- `identity/session.ts`: a check that a session belongs to the acting user.
- `src/routes/settings/`: the settings layout with side navigation, `/settings/account` (change password) and `/settings/security` (sign out everywhere). `/settings` leads to the account page.
- `src/lib/ui/SettingsLayout.svelte` and `PageHeader.svelte`: new components.
- `src/routes/+layout.svelte`: the name in the header links to settings.
- Tests beside each, plus `tests/e2e/settings.test.ts`.

**Try it**

1. Log in, then click your name in the header.
2. On "Account settings", enter a wrong current password: "That's not your current password."
3. Enter the right one and a new password twice, and save: "Password updated".
4. If you were also logged in in another browser, reload it: it has been signed out. This browser is still signed in.
5. Open "Security" and press "Sign out everywhere": you land on the login page, and every browser is signed out.

**Decisions**

- No opt-out switch for signing out other devices on a password change.
- Change password stays on the account page for now.
- Five wrong guesses at the current password pause the form for up to 15 minutes.
- Functions that act through the session refuse if the session and the acting user differ.

**SHOULD rules deviated from:** none.

**Left for later**

- A way to set a first password for people who only ever signed in with Google or Facebook (noted for tasks 11 and 12).

## Task 8: Profile basics

**Status:** Done. `npm run verify` passes (174 logic tests, 15 browser tests).

**What changed**

- `src/lib/server/modules/identity/profile.ts`: `getProfile`, `updateProfile`, `getPublicProfiles`, `getContactDetails`.
- `src/routes/settings/profile/`: the profile page and its save action.
- `src/lib/ui/SelectField.svelte`: a drop-down field.
- `src/routes/settings/+layout.svelte`: "Profile" added to the navigation.
- Tests beside each, and a browser test in `tests/e2e/settings.test.ts`.

**Try it**

1. Log in and click your name in the header. You land on "Profile".
2. Change your name, pick "Svenska" and "Europe/Stockholm", and save: "Profile saved".
3. Reload the page: the values are still there, and the header shows the new name.

**Decisions**

- English and Swedish are offered; Swedish is marked as not available yet.
- City, Bio and the public preview from the prototype were not built, because they are not in the requirements.
- Language and time zone are on the profile page, following the design doc, not the prototype.

**SHOULD rules deviated from:** none.

**Left for later**

- Username (task 9) and photo (task 10) join this page next.
- If you want City and Bio, they need adding to the requirements and the database first.

## Task 9: Change username

**Status:** Done. `npm run verify` passes (186 logic tests, 16 browser tests).

**What changed**

- `src/lib/server/modules/identity/username.ts`: `changeUsername`, `usernameChangeAllowedAt`, and an availability check that respects holds.
- `identity/schema.ts` and `migrations/0003_username_holds.sql`: the `username_holds` table.
- `src/routes/settings/profile/`: a Username card with a live availability check, and its action.
- `src/routes/api/username-available/+server.ts`: knows who is asking.
- `src/lib/ui/TextField.svelte`: can be switched off.
- Tests beside each, and a browser test in `tests/e2e/settings.test.ts`.

**Try it**

1. Run `npm run db:migrate` (there is a new table).
2. Open your profile and set a username. "Available" appears as you type; save it.
3. Change it to something else and save. That works once.
4. Reload: the field is switched off, with the date you can change it again.
5. Log in as a second person and try to take the first person's old username: "already taken".

**Decisions**

- A first username doesn't start the 30-day clock.
- The owner can take a held name back; nobody else can.
- A username can be removed, which counts as a change.
- A change of capital letters only is not a change.

**SHOULD rules deviated from:** none.

**Left for later**

- Clearing out holds whose 30 days have passed is part of the daily job in task 15. Until then expired rows stay in the table but no longer block anyone.
