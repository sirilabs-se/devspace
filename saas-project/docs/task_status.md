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

## Task 10: Avatar upload

**Status:** Done. `npm run verify` passes (203 logic tests, 17 browser tests).

**What changed**

- `src/lib/server/storage/index.ts`: the file storage helper (save, read, delete), on local disk for now.
- `src/lib/server/modules/identity/avatar.ts`: `setAvatar`, `removeAvatar`, `readAvatar`.
- `src/routes/files/avatars/[file]/+server.ts`: serves the pictures.
- `src/routes/settings/profile/`: a Photo card with upload, replace and remove.
- `src/lib/ui/Avatar.svelte` and `FileField.svelte`: new components.
- `src/lib/server/public-paths.ts`: pictures are reachable without a login.
- `.gitignore`, `.env.example`, `tests/setup/test-env.js`: the storage settings.
- Tests beside each, and a browser test in `tests/e2e/settings.test.ts`.

**Try it**

1. Open your profile. Your initials are shown in a circle.
2. Choose a JPEG, PNG or WebP under 2 MB and press "Upload photo": the picture replaces the initials.
3. Try a text file, or a picture over 2 MB: a clear error.
4. Press "Remove photo": the initials return, and the file is gone from `.data/uploads/avatars/`.

**Decisions**

- Files are kept on local disk until a storage provider is chosen.
- **A new public endpoint, `/files/avatars/[file]`, which the design did not have.** I added it because the task can't work without a way to show the picture. Please confirm it, or tell me you'd rather wait for object storage.
- JPEG, PNG and WebP up to 2 MB; the real file type is checked; SVG is refused.
- No cropping or resizing.

**SHOULD rules deviated from:** none.

**Left for later**

- Cropping and resizing, which need an image library.
- Raising the production upload limit, and choosing object storage (task 27).
- Deleting the picture when an account is permanently deleted (task 15).

## Task 11: Google and Facebook sign-in

**Status:** Blocked on your credentials. The code is complete and `npm run verify` passes (220 logic tests, 19 browser tests), but it has only been tested against stand-ins for Google and Facebook, not the real services.

**What changed**

- `src/lib/server/modules/identity/social.ts`: start a provider sign-in, handle the return, the welcome step.
- `identity/auth.ts`: the provider settings, no automatic merging of accounts, and an audit entry for provider sign-ins.
- `identity/session.ts`: the signed-in user now carries their picture and whether the welcome step is pending.
- `src/routes/api/auth/[...path]/+server.ts`: the return address, with everything else closed.
- `src/routes/welcome/`: the welcome page.
- `src/hooks.server.ts`: holds people at `/welcome` until it is completed.
- `src/routes/login/` and `signup/`: the provider buttons, and a message when a provider sign-in is refused.
- `src/lib/ui/ProviderButton.svelte`: new component.
- `.env.example` and `tests/setup/test-env.js`: the four new settings.
- Tests beside each.

**Try it**

Without credentials, nothing new is visible: the buttons only appear for a provider whose credentials are set.

1. Create an OAuth app in the Google Cloud console (and a Facebook app in Meta for Developers).
2. Register the return address `http://localhost:5173/api/auth/callback/google` (and `.../facebook`).
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (and the Facebook pair) in `saas-project/.env`, then restart `npm run dev`.
4. On the login page, press "Continue with Google" and sign in there.
5. You come back to "Welcome, <name>". Tick the box, optionally choose a username, and continue: you land on the home page, signed in.
6. Log out, then sign up with email and password using a second Google account's address, verify it, log out, and press "Continue with Google" with that Google account: you are sent back to login with "That email already has an account".

**Decisions**

- Built without real credentials, tested against stand-ins. Two checks stay unticked until you try it for real.
- Only the provider return addresses are open under `/api/auth/`.
- The sign-up form action was renamed to `register` (a SvelteKit requirement once the provider buttons were added).

**SHOULD rules deviated from:** none.

**Left for later**

- Trying it with real Google and Facebook credentials, then ticking the two checks and setting the task to Done.
- Setting a first password for people who only use a provider (noted for task 12).

## Task 12: Connected accounts

**Status:** Blocked on your credentials, like task 11. The code is complete and `npm run verify` passes (237 logic tests, 19 browser tests), tested against a stand-in for Google.

**What changed**

- `src/lib/server/modules/identity/connections.ts`: list, connect and disconnect providers, and set a first password.
- `identity/auth.ts`: connecting may use a different email; connections are recorded in the audit log.
- `src/routes/settings/connections/`: the Connected accounts page.
- `src/routes/settings/account/`: shows "Set a password" for people who have none.
- `src/lib/ui/ListRow.svelte`: new component.
- Tests beside each.

**Try it** (needs the credentials from task 11)

1. Log in with your email and password and open Settings, then "Connected accounts".
2. Press "Connect" beside Google and sign in there. You return to "Google connected".
3. Log out and press "Continue with Google": you land in the same account.
4. Back on "Connected accounts", press "Disconnect": it works, because your password remains.
5. Sign up as a new person using only Google, then try to disconnect Google: it is refused, with a link to set a password first.
6. Set a password on "Account settings", then disconnect Google: now it works.

**Decisions**

- Connecting allows a provider account with a different email.
- A first-password form was added for provider-only people, so the last-method rule can't trap them.

**SHOULD rules deviated from:** none.

**Left for later**

- Trying it with real credentials, then ticking the first check and setting the task to Done.
- Counting passkeys as a way to sign in (task 17).

## Task 13: Change email

**Status:** Done. `npm run verify` passes (254 logic tests, 19 browser tests).

**What changed**

- `src/lib/server/modules/identity/change-email.ts`: request a change, tell the old address, undo.
- `identity/verify-email.ts`: recognises a link that confirms a change of email.
- `identity/emails.ts`: three new emails (confirm new address, notice to old address, change undone).
- `identity/link-token.ts`: reads what a link token says.
- `src/routes/settings/account/`: an Email card.
- `src/routes/undo-email-change/`: the undo page.
- `src/lib/server/public-paths.ts`: the undo page works without a login.
- Tests beside each.

**Try it**

1. Open "Account settings". In the Email card, enter a new address and your password, and press "Change email".
2. Your email has not changed yet. Open http://localhost:8025 and click the link in the email sent to the new address.
3. You see "Email verified" with the new address. Log out and log in with the new address; the old one no longer works.
4. In the inbox, open the notice sent to the old address and click its undo link.
5. Press "Undo the change": the old address works again and every device is signed out.

**Decisions**

- **A new public page, `/undo-email-change`, which the design did not list.** The undo can't work without it. Please confirm it.
- The undo period is 7 days (the suggested default). Please confirm.
- Starting a change needs the current password.
- Undoing signs every device out.

**SHOULD rules deviated from:** none.

**Left for later**

- Nothing in this task.

## Task 14: Security activity page

**Status:** Done. `npm run verify` passes (260 logic tests, 19 browser tests).

**What changed**

- `src/lib/server/modules/identity/activity.ts`: `listSecurityActivity`.
- `src/lib/server/modules/identity/device.ts`: turns a browser's self-description into plain words.
- `src/routes/settings/security/`: a "Recent security activity" card.
- Tests beside each, and a check added to the settings browser test.

**Try it**

1. Log in, fail a login on purpose from another browser window, and change your password.
2. Open Settings, then "Security". Under "Recent security activity" you see those events, newest first, each with its time, device and network address.
3. Change your time zone on the profile page and come back: the times follow it.

**Decisions**

- Shows the newest 50 events, with no paging.
- Shows the network address as well as the device, since it is the person's own data and helps spot a stranger.

**SHOULD rules deviated from:** none.

**Left for later**

- Also included in this commit: one line missing from the Identity doc for task 13's undo page.

## Task 15: Delete account

**Status:** Done. `npm run verify` passes (277 logic tests, 21 browser tests).

**What changed**

- `src/lib/server/modules/identity/deletion.ts`: `requestAccountDeletion`, `onUserDeleted`, `runDailyJob`.
- `identity/deletion-cancel.ts`: cancels a pending deletion when a session starts.
- `identity/auth.ts`: calls that on every sign-in.
- `identity/emails.ts`: the scheduled, cancelled and deleted emails.
- `src/routes/api/jobs/daily/+server.ts`: the protected endpoint.
- `src/routes/settings/account/`: a "Delete account" card.
- `src/routes/login/`: a notice after asking to delete.
- `.env.example` and `tests/setup/test-env.js`: `DAILY_JOB_SECRET`.
- Tests beside each, and two browser tests.

**Try it**

1. Open "Account settings", scroll to "Delete account", enter your password, tick the box and press "Delete my account".
2. You are signed out and see "Your account is scheduled for deletion". An email says when.
3. Log in again: the account is back, and an email confirms the deletion was cancelled.
4. To see the permanent deletion without waiting 30 days, ask to delete again, then move the date back and run the job:

   ```
   docker exec saas-project-db-1 psql -U saas -d saas -c "update users set deletion_requested_at = now() - interval '31 days' where deletion_requested_at is not null"
   curl -X POST -H "Authorization: Bearer $(grep DAILY_JOB_SECRET .env | cut -d= -f2)" http://localhost:5173/api/jobs/daily
   ```

   The answer lists what was removed. The account can no longer log in, and its username can't be registered.
5. Run the `curl` line without the header: it is refused.

**Decisions**

- Asking to delete needs the password and a ticked box.
- One card, not the prototype's five-step flow.
- The job also clears stale attempt counters.

**SHOULD rules deviated from:** none.

**Left for later**

- Scheduling the job once a day in production (task 27).

## Task 16: Notification preferences

**Status:** Blocked, not started. You chose to skip it for now.

No notification types exist until another module defines one, so the page would have nothing to show. Nothing was built for this task: no table, page or function. It is ready to be picked up when the first module that sends notifications arrives; that module should say which types exist.

## Task 17: Passkeys

**Status:** Done. `npm run verify` passes (291 logic tests, 23 browser tests).

**What changed**

- `src/lib/server/modules/identity/passkeys.ts`: list, rename and remove passkeys.
- `identity/schema.ts` and `migrations/0004_passkeys.sql`: the `passkeys` table.
- `identity/auth.ts`: the passkey add-on, and audit entries for passkey sign-ins and new passkeys.
- `identity/social.ts`: the four passkey addresses on the allowed list.
- `identity/connections.ts`: passkeys count as a way to sign in.
- `src/lib/shared/passkey-browser.ts`: the browser's side of the exchange.
- `src/routes/settings/security/`: a Passkeys card.
- `src/routes/login/`: "Continue with passkey".
- `src/lib/ui/Button.svelte` and `Icon.svelte`: a click handler and a fingerprint icon.
- `tests/e2e/base.ts`: shared set-up for browser tests.
- `package.json`: `@better-auth/passkey`.
- Tests beside each, plus `tests/e2e/passkeys.test.ts`.

**Try it**

1. Run `npm install` and `npm run db:migrate`.
2. Log in, open Settings then "Security", give the passkey a name and press "Add a passkey". Your browser or device asks for a fingerprint, face, PIN or security key.
3. Log out. On the login page press "Continue with passkey": you are signed in with nothing typed.
4. Back on "Security", press "Remove" beside the passkey.

Passkeys need `localhost` or an HTTPS address; they won't work if you open the app by IP address.

**Decisions**

- The browser side uses the browser's own passkey features, with no extra library.
- One extra column, `aaguid`, because the add-on needs it.
- This module alone decides what the last way to sign in is.

**SHOULD rules deviated from:** none.

**Left for later**

- A rename control on the page.
- Lengthening the one-day window for adding a passkey, if it proves annoying.

## Task 18: Authenticator app and backup codes

**Status:** Done. `npm run verify` passes (315 logic tests, 25 browser tests).

**What changed**

- `src/lib/server/modules/identity/two-step.ts`: set-up, switching on and off, backup codes, finishing a login.
- `identity/log-in.ts`: a correct password now answers "second step" when it is on.
- `identity/schema.ts` and `migrations/0005_two_factors.sql`: the `two_factors` table.
- `identity/auth.ts`: the two-factor add-on.
- `src/routes/login/two-step/`: the code page.
- `src/routes/settings/security/`: a "Two-step verification" card.
- `src/lib/ui/QrCode.svelte` and `CodeList.svelte`: new components.
- `package.json`: `uqr`.
- `tests/setup/totp.ts`: plays the authenticator app in tests.
- Tests beside each, plus `tests/e2e/two-step.test.ts`.

**Try it**

1. Run `npm install` and `npm run db:migrate`.
2. Install an authenticator app on your phone if you don't have one.
3. Log in, open Settings then "Security". In "Two-step verification", enter your password and press "Set up two-step verification".
4. Scan the QR code with the app, enter the 6-digit code it shows, and press "Turn on".
5. Save the backup codes that appear. They are shown only this once.
6. Log out and log in with your password: you are asked for a code. Enter it from the app.
7. Log out again, and this time choose "Use a backup code instead". The code works; the same code won't work a second time.

**Decisions**

- One code field, not six boxes.
- Passkey and provider sign-ins don't ask for the second step.
- 10 code attempts per 15 minutes per network address.

**SHOULD rules deviated from:** none.

**Left for later**

- Email codes and "trust this device" are task 19.

## Task 19: Email code and trusted devices

**Status:** Done. `npm run verify` passes (325 logic tests, 26 browser tests).

**What changed**

- `src/lib/server/modules/identity/two-step.ts`: `sendTwoStepEmailCode`, and `completeTwoStepLogin` now takes an emailed code and a "trust this device" choice.
- `identity/auth.ts`: the emailed-code and trusted-device settings.
- `identity/emails.ts`: the sign-in code email.
- `identity/log-in.ts`: recognises a trusted device.
- `src/routes/login/two-step/`: "Email me a code", "Trust this device for 30 days", and switching between the three kinds of code.
- Tests beside each, and the two-step browser test now covers trusting a device.

**Try it** (with two-step verification on, from task 18)

1. Log out and log in with your password. On the code page press "Email me a code".
2. Open http://localhost:8025, read the 6-digit code and enter it.
3. Log out and log in again. This time tick "Trust this device for 30 days" before pressing Verify.
4. Log out and log in once more in the same browser: your password is enough.
5. Log in from a different browser, or a private window: you are asked for a code again.

**Decisions**

- Emailed codes last 10 minutes; 5 requests per 15 minutes per network address.
- The trusted-device mark is the login library's signed cookie, with no extra table.

**SHOULD rules deviated from:** none.

**Left for later**

- A way to see and revoke trusted devices individually.

## Task 20: Active sessions

**Status:** Done. `npm run verify` passes (334 logic tests, 27 browser tests).

**What changed**

- `src/lib/server/modules/identity/sessions.ts`: `listActiveSessions`, `endSession`.
- `identity/library-headers.ts`: hands the login library the device and the real network address.
- `identity/log-in.ts`, `verify-email.ts`, `two-step.ts`, `social.ts`: use it, so sessions record where they started.
- `src/routes/api/auth/[...path]/+server.ts`: passes the real network address.
- `src/routes/settings/security/`: a "Where you're signed in" card.
- Tests beside each, and a two-browser test in `tests/e2e/settings.test.ts`.

**Try it**

1. Log in in your usual browser, and again in a second browser or a private window.
2. In the first, open Settings then "Security". Under "Where you're signed in" you see both, with the one you are using marked "this device".
3. Press "End session" beside the other one.
4. Reload the second browser: it has been signed out.

**Decisions**

- "Last active" is accurate to within a day.
- The session in use can't be ended from the list.

**SHOULD rules deviated from:** none.

**Left for later**

- Listing and revoking trusted devices.

## Task 21: New-device alerts

**Status:** Done. `npm run verify` passes (343 logic tests, 27 browser tests).

**What changed**

- `src/lib/server/modules/identity/device-recognition.ts`: `recogniseDevice`.
- `identity/emails.ts`: the "New sign-in" email.
- `src/hooks.server.ts`: runs the check for each signed-in request.
- `src/routes/settings/security/+page.svelte`: wording for the new event in the activity list.
- Tests beside each.

**Try it**

An account less than 15 minutes old gets no alert, so use one you made earlier, or wait.

1. Log in in your usual browser. No email arrives: it is already known.
2. Log in to the same account in a different browser or a private window.
3. Open http://localhost:8025: there is a "New sign-in to your SaaS account" email naming the browser and the time.
4. Log out and in again in that second browser: no further email.

**Decisions**

- You chose the cookie-per-browser approach.
- No alert for an account's first browser while the account is under 15 minutes old.
- One check in `hooks.server.ts` covers every sign-in method.

**SHOULD rules deviated from:** none.

**Left for later**

- Nothing in this task. This completes Phase 2.

## Task 22: Admin user search

**Status:** Done. `npm run verify` passes (366 logic tests, 28 browser tests).

**What changed**

- `src/lib/server/modules/identity/admin.ts`: `searchUsers`, `getUserForAdmin`.
- `identity/session.ts`: the signed-in user's role, and `requireRole`.
- `identity/auth.ts`: the admin add-on.
- `src/hooks.server.ts`: refuses `/admin` to non-admins.
- `src/routes/admin/`: the layout, the user list with search and paging, and the user details page.
- `scripts/grant-admin.js` and `package.json`: `npm run admin:grant`.
- `src/routes/+layout.*`: an "Admin" link in the header for admins.
- `src/lib/ui/Button.svelte`: can carry a form field.
- `CLAUDE.md`: the new command.
- Tests beside each, plus `tests/e2e/admin.test.ts`.

**Try it**

1. Make yourself an admin: `npm run admin:grant -- your@email` (use the email you signed up with), then log out and back in.
2. An "Admin" link appears in the header. Open it.
3. Search for part of an email, name or username, and press "Open" beside a result.
4. Log in as a different, ordinary account and visit http://localhost:5173/admin/users: "You don't have access to this area".

**Decisions**

- 25 to a page, with a page number. Please confirm.
- The first admin is made from the command line.
- An admin opening a user's page is recorded.

**SHOULD rules deviated from:** none.

**Left for later**

- Suspend, reinstate, impersonate and the audit log view are tasks 23 to 25.
