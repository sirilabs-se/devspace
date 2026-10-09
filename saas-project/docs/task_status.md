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
