# Tyvo Backend — Handoff Notes (against Backend Build Brief v1)

Written from a sandboxed environment with **no internet access** — I could
not install `@prisma/client`/`grammy`/`prisma` (npm registry is blocked),
connect to a real Postgres instance, register a Telegram bot, or call
Kavenegar. Everything below is real, reviewed code, hand-verified with
`node --check` and — where possible without a database — actual unit
tests against mock data. It has **not** run against a live DB, a live
Telegram webhook, or live SMS. Treat this as a strong first draft for
Cursor/K1 to install, wire real credentials into, and smoke-test for real.

## What's implemented, by phase

**Phase 1 — Data layer:** `prisma/schema.prisma` matches brief §3, plus one
addition (see "Deviations" below). `prisma/seed.js` seeds the 7 spaces
verbatim from the prototype's `rooms` array, in the same order.

**Phase 2 — Booking API:** all three endpoints (`spaces`, `availability`,
`bookings`), full §5 rule set:
- 12h minimum lead time (`lib/validate.js`)
- server-side phone re-validation + Persian digit normalization (matches
  the frontend's checks exactly, so both sides agree)
- §5.1 slot-taken check (confirmed bookings + blocked_slots)
- §5.3 conflict warning (checks for any other pending/confirmed booking on
  the same slot before notifying admins)
- Jalali-aware availability grid (`lib/availability.js`)

**Phase 3 — Telegram bot:** `netlify/functions/telegram-webhook.js` using
grammy's `webhookCallback` (lambda mode, matches Netlify Functions).
Whitelist gate, confirm/reject inline buttons, §5.4 race-condition
re-check on confirm, §5.5 auto-flag of other pending bookings on the same
slot, `/today` + `/upcoming` command. Edits every admin's copy of the
message in place (see "Deviations").

**Phase 4 — SMS:** `lib/kavenegar.js` wired to the Verify Lookup
(templated) API, called from the webhook on confirm/reject only — no SMS
at submission, matching §6. **Kavenegar pattern approval is a manual step
or already started; give me the exact approved template text once it's
back, so I can fix the token order/count in `lib/kavenegar.js` to match.**

**Phases 5–7 (frontend wiring, QA, deploy):** not started — these need a
live API to wire the frontend against, which needs Phase 1 actually
migrated to a real database first.

## Verified without a database

Ran real unit tests against mock data (not just syntax checks):
- `lib/jalaali.js` — round-trips correctly, matches the known Nowruz
  reference date (2024-03-20 = 1403/01/01), leap-year month lengths
  correct. This is a byte-for-byte port of the already-tested prototype
  code, not a reimplementation — client and server use identical math.
- `lib/validate.js` — Iranian phone format + Persian digit normalization.
- `lib/availability.js` — `computeMonthAvailability()` correctly closes
  slots for lead-time, confirmed-overlap, and blocked-overlap; leaves
  everything else open.
- `lib/notifications.js` — message text renders correctly, including the
  §5.3 conflict warning.

## Deviations from the literal brief (flagging, per the brief's own "flag
rather than guess" instruction)

1. **Slot hours: 10:00–20:00, not 09:00–20:00.** Brief §4 says
   "09:00-20:00, matching prototype" — but the actual approved prototype's
   `timeSlots` array starts at 10:00 (11 hourly slots, 10:00 through
   20:00, no 09:00 slot). Since the brief says "matching prototype" and
   the prototype is the tested/approved source of truth, I used the real
   prototype list. `lib/availability.js`'s `TIME_SLOTS` constant is a
   one-line change if you actually want a 09:00 opening slot.

2. **Added a `TelegramMessage` table**, not in the brief's §3 schema.
   Brief §7 says notifications go to *all* `admin_whitelist` chat_ids
   (plural) and confirm/reject should "edit the original message in
   place." A single `booking.telegram_chat_id` / `telegram_message_id`
   field can only track *one* admin's copy — if three admins each get
   their own DM with buttons, editing "the" message after one of them
   taps Confirm would leave the other two admins' copies stale and
   clickable, which is exactly the kind of double-confirm risk §5.3/5.4
   are trying to prevent. `TelegramMessage` (one row per booking per
   admin who was notified) lets confirm/reject edit *every* copy. Small
   schema addition, but changes migration output — flagging explicitly
   rather than silently deviating from the literal §3 spec.

## Admin roles (Telegram)

`AdminWhitelist.role` is `owner` or `approver`:
- **owner** — sees every new-booking notification (full text), but no
  confirm/reject buttons. Can run `/addadmin`, `/removeadmin`, `/setrole`.
  Cannot confirm/reject bookings (enforced both by omitting the buttons
  and, defense in depth, by a role check in the callback handler).
- **approver** (rental manager) — sees every new-booking notification WITH
  confirm/reject buttons. Cannot manage the admin list.

Commands and their access gates:
- `/today`, `/upcoming` — any whitelisted admin.
- `/whoami` — any whitelisted admin; replies with the caller's own label + role.
- `/calendar` — any whitelisted admin; next 14 days, grouped by day, same
  detail level for both roles (owners see everything, just can't act on it).
- `/addadmin <chat_id> <name> <role>` — owner only.
- `/removeadmin <chat_id>` — owner only.
- `/setrole <chat_id> <role>` — owner only.

**Safety invariant:** the system must never end up with zero owners.
`/removeadmin` and `/setrole` both refuse if the target is the *only*
remaining owner (removing or demoting them), so there's always at least
one owner able to manage the admin list.

## Not yet done / needs real infrastructure to finish

- Race-condition guard on the *create* path (two people submitting the
  same slot within milliseconds of each other) currently relies on
  Postgres's own read-then-write timing — fine for expected traffic, but
  if this needs to be airtight, wrap the confirmed-overlap check + insert
  in a `SERIALIZABLE` transaction or add a partial unique index on
  `(space_id, start_at) WHERE status = 'confirmed'`. Worth deciding once
  you have a real DB to test the retry behavior against.
- `GET /api/bookings/:reference_code` is built (brief flagged it as "cheap
  to include now") but nothing calls it yet — it's there for whenever a
  "check my booking" page happens.
- No automated test suite wired up (no test runner installed, given the
  network constraint) — the "unit tests" above were one-off `node -e`
  scripts I ran by hand, not a committed test file. Worth turning into a
  real Jest/Vitest suite once the repo has npm access.
- Everything in brief §8 Phase 6 (bilingual pass, real-device test, actual
  concurrent-booking race test, Jalali year-rollover edge case) needs a
  live deployment — can't do any of that from here.

## To actually run this

```bash
npm install
cp .env.example .env   # fill in real values
npx prisma migrate dev --name init
npx prisma db seed
netlify dev             # or deploy to Netlify and set env vars there
```

Then register the Telegram webhook once deployed:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<site>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
