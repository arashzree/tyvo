# Tyvo Backend — Pre-Handover Audit

Written as an outside technical review, not by the implementer. Verified directly
against the code on `main` (HEAD `c9be1f1`) as of 2026-09-13, not against
`docs/BOT_SPEC.md`'s prose, which is stale in places (see M6). Every claim below
was checked by reading the cited file:line or by running the code; nothing here
is copied from the existing docs without re-verification.

`docs/CLAUDE.md` and `docs/BOT_UX.md` were requested as inputs to this audit —
**neither file exists in the repo.** That's a finding in itself; see D1.

---

## 1. What the system actually does today (as built)

**Public website** (`public/`) — a bilingual (fa/en) single-page prototype. Customers
pick a space, a Jalali (fa) or Gregorian (en) date, and an hourly slot
(10:00–20:00), enter name/phone/email/notes, and submit. The frontend calls three
public, unauthenticated Netlify Functions:
- `GET /api/spaces` — list active spaces.
- `GET /api/availability?id=&month=YYYY-MM` — per-day/per-slot open-closed grid for one Jalali month, computed from confirmed bookings + blocked slots (pending bookings never block a slot).
- `POST /api/bookings` — creates a `pending` booking after re-validating phone/email/lead-time/slot-freeness server-side; on success, DMs every `owner`+`rental_manager` in `AdminWhitelist` via Telegram.

**Telegram bot** (`netlify/functions/telegram-webhook.js`, grammy) — the only
admin/staff interface. Three roles: `owner` (2 people, full visibility, no
approve/reject, manages the whitelist), `rental_manager` (1 person, full
visibility, approve/reject buttons), `member` (whitelisted staff synced
automatically from a private Telegram group, `/available <space>` only —
free/busy slots, no names/phones/reference codes). A whitelist gate
(`:79-92`) rejects any chat_id not in `AdminWhitelist`, except the tracked
group chat_id itself, which is silently ignored rather than replied to.

Rental manager taps ✅/❌ on a booking DM; this re-checks the slot is still
free (race guard), flips status, edits every admin's copy of the message in
place, fires a Kavenegar SMS to the customer, and auto-flags (not
auto-rejects) any other pending request for the same now-taken slot.

**Data model** (Postgres via Prisma): `Space`, `Booking`, `TelegramMessage`
(one row per admin per booking, for the in-place edits), `BlockedSlot`
(defined, migrated, read — never written, see M4), `AdminWhitelist`.

**What doesn't exist**: reminders/cron, in-bot self-booking for members
(deferred by design), SMS at booking creation (by design, SMS only on
confirm/reject), any automated test, any staging environment, any error
monitoring.

The role-model work described as a plan in `docs/ROLE_GAP.md` has actually
shipped — I verified every permission check in `telegram-webhook.js` and
`bookings.js` against that plan and it matches. That doc is accurate;
`docs/BOT_SPEC.md` is not (M6).

---

## 2. Findings, ordered by what to fix first

### 1. [BLOCKER] Booking times are wrong everywhere except the raw DB timestamp — frontend and backend disagree on what a slot's clock time means

**What breaks:** The frontend builds a booking's `start_at` from the
customer's **browser-local wall clock**, then correctly converts it to a real
UTC instant with `.toISOString()`. The backend's Jalali↔Gregorian slot math
does the opposite: it treats the slot-label hour digits as if they *were*
UTC, with no offset applied. For an Iran-based customer (fixed UTC+3:30,
no DST since 2022) these two conventions are 3.5 hours apart, and I confirmed
this empirically:

```
Customer picks "14:00" on 2026-09-20 (Tehran wall clock)
→ frontend sends start_at = 2026-09-20T10:30:00.000Z   (correct real instant)
→ backend's own slot-boundary math for label "14:00"  = 2026-09-20T14:00:00.000Z
→ 3.5 hour mismatch, every single booking, deterministically
```

Concrete consequences:
- **Every Telegram display of a booking's time is wrong by 3.5h.** `formatJalaaliDateTime`/`formatJalaaliTime` (`lib/notifications.js:6-12,22-27`) read `getUTCHours()` straight off the stored (correct) UTC instant, so a customer's "14:00" booking is announced to admins — in the new-booking push, `/today`, `/calendar`, `/available`, the confirmed/rejected edit, and the Kavenegar SMS token — as **"10:30."** Staff will act on the wrong actual time.
- **The customer-facing availability grid is wrong by the same offset.** `computeMonthAvailability`/`computeRangeAvailability` (`lib/availability.js:42-56,71-86`) build each slot's boundary via `dateFromJalaaliDateTime` (`lib/jalaali.js:106-109`, `Date.UTC(gy, gm-1, gd, hour, minute)` — no offset), then check it against confirmed bookings' real timestamps. A confirmed 14:00-label booking (stored 10:30 UTC) does not overlap the grid's 14:00 UTC slot boundary at all — it spills into the 10:00/11:00-labeled slots instead. Net effect: **the calendar shows a truly-booked slot as open**, and shows unrelated open slots as full.
- The create-time 409 conflict check in `bookings.js` compares real timestamps to real timestamps, so it is internally self-consistent and will *not* let two customers end up `confirmed` on the same real instant — but a customer who picks the visually-open "14:00" (because the grid is wrong) will submit successfully as `pending`, then get a confusing rejection or silent conflict resolution later, for a slot the UI told them was free.

**File:line:** `public/js/booking-flow.js:544,556`; `lib/jalaali.js:106-109`;
`lib/availability.js:42-56,71-86`; `lib/notifications.js:6-12,22-27`;
`netlify/functions/availability.js:34-35`.

**Effort:** Medium. Pick one canonical convention and make both sides agree —
either have the frontend build slot timestamps the same offset-free way the
backend does (`Date.UTC` with the raw slot digits, no local-time
construction), or make the backend's Jalali math offset-aware for
`Asia/Tehran`. The former is the smaller change. Needs a real regression
test afterward (see #3) — this is not a one-line fix to eyeball.

---

### 2. [BLOCKER] Real production secrets are sitting in the working tree, uncommitted but unprotected, with a live GitHub remote attached

**What breaks:** `.env` contains the real Neon Postgres connection string
(with password). `set-webhook.sh` and `set-wbhook.sh` both contain the real
Telegram bot token and the real webhook secret **in plaintext**. `git status`
shows all of these as untracked — and `.gitignore` only excludes `.netlify`.
`git remote -v` confirms `origin` is `https://github.com/arashzree/tyvo.git`.
Any future `git add -A` / `git add .` (easy to type on autopilot) stages
these, and the next `git push` puts your production DB password and live
bot token on GitHub. I confirmed via `git log --all -- .env
set-webhook.sh set-wbhook.sh` that none of these have been committed yet —
so no rotation is strictly required *today*, but this is one careless
command away from a real incident, not a hypothetical one.

**File:line:** `.env` (repo root); `set-webhook.sh`; `set-wbhook.sh`; `.gitignore` (missing entries).

**Effort:** Trivial — add `.env`, `set-webhook.sh`, `set-wbhook.sh`,
`node_modules/` to `.gitignore` right now. Also just delete the two
webhook shell scripts once the webhook is set (they're one-time setup
commands, not something that belongs living in the repo with a secret
baked in) or template them like `.env.example` does.

---

### 3. [HIGH] The bot has no error boundary — a failing command fails completely silently, and you cannot see why

**What breaks:** No `bot.catch(...)` is registered anywhere, and no
`bot.command()` handler wraps its Prisma calls in try/catch (the only three
`try` blocks in the file are `resolveChatLabel`'s `getChat` fallback and the
two SMS sends). If a Prisma call throws — a cold-start connection hiccup, a
Neon blip, anything — the admin who ran `/today`/`/calendar`/`/available`/
`/addadmin`/etc. gets **no reply at all**, and per `docs/ROLE_GAP.md`'s own
notes, Netlify function log access has been 403ing all session, so there is
currently no way to even retroactively find out this happened. This directly
compounds every other bug on this list: if the timezone fix in #1 or the
race guard in #5 ever misbehaves, you will find out from the client, not
from telemetry.

**File:line:** `netlify/functions/telegram-webhook.js` (no `bot.catch`, no per-command try/catch).

**Effort:** Small. Add a `bot.catch()` that at minimum replies with a
generic "چیزی درست پیش نرفت" to the admin and `console.error`s with enough
context to be useful once log access is fixed. Pair with restoring Netlify
log access or wiring a minimal external error sink (even a Telegram DM to
owners on uncaught errors would beat total silence).

---

### 4. [HIGH] Zero automated tests

**What breaks:** No test runner is installed (`package.json` has no `test`
script, no Jest/Vitest/Mocha in `devDependencies`). `HANDOFF.md` describes
some manual `node -e` scripts run once by hand during initial development —
not a committed suite, and not re-run since. For a system with real
permission boundaries (owner/rental_manager/member) and now-confirmed-buggy
date math (#1), "it looked right when I ran it" is the only verification
method available. This is what let the timezone bug in #1 ship and sit
undetected.

**File:line:** `package.json` (no test script/deps); no `*.test.js` anywhere in the repo.

**Effort:** Medium to bootstrap. Priority order for what to cover first:
`lib/jalaali.js` + `lib/availability.js` round-trip and overlap math
(directly would have caught #1), `lib/validate.js`, the last-owner/last-
rental_manager guards in `/removeadmin` and `/setrole`, and the
confirm-race-recheck logic in `handleConfirm`.

---

### 5. [HIGH] No DB-level guard against two overlapping bookings both ending up `confirmed`

**What breaks:** The only protection against a double-confirmed overlap is
an application-level read-then-write check in `handleConfirm`
(`telegram-webhook.js:443-458`) — query for other confirmed overlaps, then
update. There is no `SERIALIZABLE` transaction and no partial unique index
(`HANDOFF.md` flagged this as a known gap at initial build; it is still
true today — no migration since has added one). If the rental manager (the
only role with confirm/reject rights, so this needs two near-simultaneous
taps, not two different people) double-taps quickly, or two different
pending requests for the same slot are confirmed within the same narrow
race window, two `confirmed` bookings can coexist for one real slot with
nothing at the DB layer stopping it.

**File:line:** `netlify/functions/telegram-webhook.js:442-465`; no matching constraint in `prisma/schema.prisma` or any migration.

**Effort:** Medium. Either wrap the recheck+update in a `SERIALIZABLE`
transaction, or add a Postgres partial unique index on `(space_id,
start_at) WHERE status = 'confirmed'` and let the DB reject the second
write outright.

---

### 6. [HIGH] Public `POST /api/bookings` has no rate limiting or abuse protection

**What breaks:** Anyone on the internet can script arbitrary booking
submissions. There's no CAPTCHA, no per-IP/per-phone throttle, nothing.
Each successful submission pages every `owner`+`rental_manager` on
Telegram — so this is also a cheap way to spam the actual humans running
the business, not just a cost/DB-noise concern.

**File:line:** `netlify/functions/bookings.js:11-104` (no rate limiting anywhere in the handler).

**Effort:** Medium. Simplest fix: a lightweight per-phone-number and
per-IP throttle (even a crude one, e.g. reject >N pending bookings from the
same phone in an hour) before reaching to Netlify Edge/WAF-level
rate limiting.

---

### 7. [MEDIUM] TOCTOU races in whitelist writes (group-join sync, `/addadmin`, `/addmember`)

**What breaks:** All three code paths that add a row to `AdminWhitelist` —
the `new_chat_members` group-sync handler (`:39-49`), `/addadmin`
(`:295-305`), `/addmember` (`:321-330`) — do `findUnique` then branch into
`create`/`update`, rather than an atomic `upsert`. Two near-simultaneous
invocations for the same chat_id (e.g. a rapid join/leave/rejoin in the
group, or a double-tap on `/addadmin`) can both pass the `findUnique` check
and then race on `create`, and the loser throws an unhandled Prisma
unique-constraint violation — which, per finding #3, fails completely
silently.

**File:line:** `netlify/functions/telegram-webhook.js:43-48,297-304,323-329`.

**Effort:** Small — swap each to `prisma.adminWhitelist.upsert(...)`.

---

### 8. [MEDIUM] `.env.example` doesn't list `TYVO_GROUP_ID`

**What breaks:** The bot's group-membership sync (`docs/ROLE_GAP.md` §6,
shipped in `c9be1f1`) hard-depends on `TYVO_GROUP_ID`, but `.env.example`
only lists `DATABASE_URL`, `KAVENEGAR_API_KEY`, both Kavenegar templates,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Anyone bootstrapping this
project from `.env.example` alone — the client's next developer, or you in
six months — will not know this variable needs to exist, and member sync
will silently no-op (every group event falls through to "unrecognized
chat," logged only, per finding #3, nowhere you can currently see).

**File:line:** `.env.example` (missing entry); required at `netlify/functions/telegram-webhook.js:34,54,70,81`.

**Effort:** Trivial — add the line.

---

### 9. [MEDIUM] `BlockedSlot` is fully dead — schema, migration, and two read sites, zero writes

**What breaks:** Nothing functionally (the table is always empty, so its
read sites are no-ops), but it's a maintenance trap: the next person
touching availability logic will reasonably assume blocking a slot for
maintenance/cleaning/etc. is a supported, working feature because it's
wired into both `bookings.js`'s conflict check and `availability.js`'s
grid. It isn't — there is no command, callback, or endpoint anywhere that
creates, updates, or deletes a row.

**File:line:** `prisma/schema.prisma:80-92`; read at `netlify/functions/bookings.js:59-62`, `netlify/functions/availability.js:47-54`; zero write sites anywhere in the repo (verified via repo-wide grep).

**Effort:** Small to decide/document either way; medium if you actually
build a `/block <space> <date> <time> [reason]` owner command, which is
probably worth doing since manual slot-blocking (studio maintenance,
private events) is a very ordinary rental-business need.

---

### 10. [MEDIUM] `Booking.adminActionBy` stores a mutable display label, not a stable identifier — and the schema comment says otherwise

**What breaks:** The schema comment (`schema.prisma:53`) says this field
holds "telegram chat id or username," but both write sites actually store
`ctx.adminLabel` (`telegram-webhook.js:462,507`) — the human-readable label
from `AdminWhitelist.label`, which gets silently refreshed every time
`/addadmin`/`/addmember` is re-run against an existing chat_id
(`:299,325`) or a group member's Telegram display name changes. This means
the audit trail on old bookings is a point-in-time label snapshot, not a
durable reference back to who actually acted — fine for casual reading,
misleading if anyone ever treats it as a reliable identity record (e.g. for
a dispute about who approved what).

**File:line:** `prisma/schema.prisma:53` (comment) vs. `netlify/functions/telegram-webhook.js:462,507` (actual write).

**Effort:** Small — either fix the comment to match reality (cheapest,
honest), or additionally store `chatId` alongside the label if a durable
identity trail actually matters to the business.

---

### 11. [MEDIUM] `docs/BOT_SPEC.md` is stale and will mislead anyone who trusts it as current

**What breaks:** `BOT_SPEC.md` describes the pre-role-model-refactor system
in detail — e.g. it says `/today`/`/calendar` have "no role check," that
`/addadmin` hardcodes `role: 'approver'`, that there's no `/addmember`, no
`/available`, no group sync. All of that has since been fixed/replaced (see
§1 above, and `docs/ROLE_GAP.md`, which *is* current). If you or the client
hand `BOT_SPEC.md` to anyone as "the spec," they will draw the exact wrong
conclusions about what's already fixed.

**File:line:** whole document; compare against current `netlify/functions/telegram-webhook.js` and `netlify/functions/bookings.js`.

**Effort:** Small–medium — either regenerate it against current code, or
delete it and make `docs/ROLE_GAP.md` (plus this audit) the source of truth,
with a one-line pointer left behind.

---

### 12. [MEDIUM] No staging environment — every change lands directly on the production DB

**What breaks:** There is exactly one `DATABASE_URL` (the live Neon
instance holding real customer bookings), and Prisma migrations run
straight against it. There's no second environment to test a schema
migration, the timezone fix in #1, or the race-guard fix in #5 against
before it touches real data. Per your own standing instruction, production
data must never be mutated for testing — which is correct, but it also
means right now there is *no* sanctioned way to verify any of these fixes
short of very careful manual read-only checks against prod, or standing up
a throwaway DB, which nothing in this repo currently makes easy (no
seed-into-staging script, no documented second Neon branch).

**File:line:** `.env` / `prisma/schema.prisma:9-12` (single `DATABASE_URL`, no environment split); `HANDOFF.md` never mentions a staging DB either.

**Effort:** Small to stand up (Neon supports free branch databases —
`neon branches create` gives you an isolated copy in seconds), but it's a
process change too: document it so it's actually used going forward.

---

### 13. [LOW] Assorted dead code

- `lib/telegram.js:43-45,47` exports `answerCallbackQuery`, imported at `telegram-webhook.js:4`, never called — every real call site uses grammy's own `ctx.answerCallbackQuery(...)`.
- `/upcoming` (`telegram-webhook.js:126`) is a fully working alias for `/today` but isn't listed in `/start`'s menu (`:95-123`) — harmless, just undocumented.
- `AdminRole` enum permanently carries an unused `approver` value (`schema.prisma:96`) because Postgres can't drop an enum value without recreating the type. Already correctly commented as intentional tech debt — no action needed, just noting it's still there.

**Effort:** Trivial (delete dead export/alias-doc) to none (enum value — leave it).

---

### 14. [LOW] Whitelist gate's chat-id extraction is untested against chat-less update types

**What breaks:** `String(ctx.chat && ctx.chat.id)` (`telegram-webhook.js:80`)
assumes `ctx.chat` exists for every update type grammy might hand it. In
practice every `message` and `callback_query` update does carry a chat, so
I found no live failure mode — this is a theoretical gap, not an observed
bug, worth a mental note rather than immediate action.

**File:line:** `netlify/functions/telegram-webhook.js:80`.

**Effort:** N/A — low priority, revisit only if grammy's update coverage expands.

---

### 15. [LOW] Confirm the 10:00–20:00 slot window with the client

**What breaks:** Nothing currently — `HANDOFF.md` already flagged that the
brief said "09:00–20:00, matching prototype" while the actual prototype
array starts at 10:00, and the developer deliberately went with the
prototype's real value. This is a known, already-surfaced deviation, not a
bug. Listed here only so it gets an explicit client sign-off before
handover closes the loop, rather than being an assumption baked in
forever.

**File:line:** `lib/availability.js:14`; `public/js/booking-flow.js:169`.

**Effort:** Trivial either way (it's a one-line array edit if the answer is "actually 09:00").

---

## 3. What's missing for a real handover to a non-technical client

- **D1 — `docs/CLAUDE.md` and `docs/BOT_UX.md` don't exist.** Both were
  named as inputs to this very audit and neither is in the repo. If the
  intent was a persistent AI-assistant context file and a plain-language
  description of the bot's UX for non-technical review, neither exists
  today — that's a real gap, not a stale doc.
- **D2 — `HANDOFF.md` is stale.** It was written from a sandboxed
  environment with no internet access, before most of the current system
  existed (it still lists "SMS failure visibility" as not-yet-done; that
  shipped in `f101d5e`, before `HANDOFF.md` was even committed... actually
  it predates it and was never updated after). Anyone reading it today gets
  a snapshot of a much earlier, partially-built system.
- **D3 — No non-technical "owner's manual."** Concretely missing runbook
  entries: what to do when Kavenegar needs template re-approval; how to
  update `TYVO_GROUP_ID` in Netlify if the group migrates to a supergroup
  (the bot will DM owners the new id per `ROLE_GAP.md` step 10f, but
  nothing written down tells a non-technical owner *where* to paste it);
  how to add the very first owner if `AdminWhitelist` is ever empty (today
  that only happens via `prisma/seed.js`, which requires shell/Prisma
  access); basic DB backup/restore expectations for Neon.
- **D4 — No stated data-retention or PII policy.** Customer name, phone,
  and email sit in `bookings` indefinitely with no documented retention
  window or deletion process. Worth at least a paragraph, given this is
  real customer PII for an Iran-based business.
- **Confirm Kavenegar's live status before handover.** `BOT_SPEC.md`
  (written before the current HEAD) asserted the SMS env vars were unset in
  Netlify production, based on a `netlify env:list --context production`
  run at the time. I have no live access to re-run that check from here —
  re-verify it directly before telling the client SMS confirmations work,
  since the code will now surface a failure to the admin either way
  (finding fixed, see §1's methodology note), but a customer silently never
  getting a confirmation text is still a bad first impression.

---

## Summary table

| # | Severity | Finding | Effort |
|---|---|---|---|
| 1 | Blocker | Frontend/backend timezone contract mismatch — wrong times everywhere, wrong availability grid | Medium |
| 2 | Blocker | Real secrets ungitignored in a repo with a live GitHub remote | Trivial |
| 3 | High | No bot error boundary — silent command failures, no monitoring | Small |
| 4 | High | Zero automated tests | Medium |
| 5 | High | No DB-level guard against double-confirmed overlapping bookings | Medium |
| 6 | High | Public booking endpoint has no rate limiting | Medium |
| 7 | Medium | TOCTOU races in whitelist upserts | Small |
| 8 | Medium | `.env.example` missing `TYVO_GROUP_ID` | Trivial |
| 9 | Medium | `BlockedSlot` fully dead (schema+migration+reads, no writes) | Small–Medium |
| 10 | Medium | `adminActionBy` stores mutable label, comment says otherwise | Small |
| 11 | Medium | `BOT_SPEC.md` stale vs. shipped role model | Small–Medium |
| 12 | Medium | No staging DB | Small |
| 13 | Low | Dead code (unused export, undocumented alias) | Trivial |
| 14 | Low | Whitelist gate untested against chat-less updates | N/A |
| 15 | Low | Confirm 10:00 vs 09:00 slot start with client | Trivial |
| D1–D4 | — | Handover gaps: missing CLAUDE.md/BOT_UX.md, stale HANDOFF.md, no owner's manual, no PII policy | Small–Medium each |
