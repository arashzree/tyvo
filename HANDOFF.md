# Tyvo Backend — Handoff Notes

Written for whoever picks this project up next. Replaces the original
handoff doc, which was written from a sandboxed, no-internet environment
before almost everything below existed and had gone stale (it still
described the pre-refactor owner/approver role model and several
"not yet done" items that shipped long ago). This one reflects the system
as of commit `b0b14ef`.

**Docs map** — where to actually look for things:
- `docs/AUDIT.md` — the authoritative, severity-ranked list of known gaps
  and bugs, ordered by what to fix first. Start here if you're wondering
  "what's broken / what's next."
- `docs/ROLE_GAP.md` — the design record for the 3-role model
  (owner/rental_manager/member) and the group-membership sync. Historical,
  but accurate — describes decisions that shipped, not a stale plan.
- `docs/BOT_UX.md` — message/emoji/button conventions, checked against the
  live code. Read this before touching any bot-facing text.
- `docs/OWNER_MANUAL.md` — non-technical, for the business owner. Not for
  a developer, but know it exists so you can point them at it.
- `docs/BOT_SPEC.md` — **stale, do not trust.** Predates the 3-role
  refactor; still describes the old owner/approver model in places. Left
  in place rather than deleted since parts of it (the data model section,
  mostly) are still accurate, but verify against the actual code before
  relying on anything in it. Superseded by `docs/ROLE_GAP.md` + this file.

## What's implemented today

**Public website** (`public/`) — bilingual (fa/en) booking flow against
three Netlify Functions: `GET /api/spaces`, `GET /api/availability`,
`POST /api/bookings`. Server-side validation mirrors the frontend
(phone format, lead time, slot conflicts). `POST /api/bookings` has basic
abuse protection (`lib/rateLimit.js`): an in-memory per-IP throttle and a
DB-backed per-phone-number throttle.

**Telegram bot** (`netlify/functions/telegram-webhook.js`, grammy) — three
roles: `owner` (full visibility, manages the whitelist, no approve/reject),
`rental_manager` (full visibility, approve/reject buttons), `member`
(whitelisted staff, `/available <space>` only — free/busy, no customer
data). Membership for `member` syncs automatically from one private
Telegram group (`TYVO_GROUP_ID`); `/addadmin`/`/addmember` remain as
manual fallbacks. A persistent reply keyboard (role-filtered) sits below
the input for the common commands. A global error boundary
(`handleUncaughtError`) replies to whoever triggered a failure, logs with
context, and DMs every owner — this matters because Netlify function log
access has been unreliable/403ing (see `docs/ROLE_GAP.md`), so the owner
DM is currently the most reliable way anyone finds out something broke.

**SMS** (`lib/sms.js`) — Kavenegar Verify Lookup API, sent only on
confirm/reject (never at submission). Failures on *either* path are
surfaced to the acting admin in-chat, not just logged silently.

**Timezone handling** (`lib/jalaali.js`) — Asia/Tehran is a fixed UTC+3:30
offset (Iran dropped DST in 2022), applied consistently in both
directions: `dateFromJalaaliDateTime`/`dateFromJalaali` convert a Tehran
wall-clock Jalali date/time to the correct real UTC instant;
`instantToTehranParts` is the inverse, and every display path
(`lib/notifications.js`) goes through it. This was a real, shipped bug
until commit `462c938` — see `docs/AUDIT.md` finding #1 for what broke and
how it was verified fixed. Covered by `test/jalaali.test.js`.

**Data model** (`prisma/schema.prisma`) — `Space`, `Booking`,
`TelegramMessage` (one row per admin per booking, for in-place message
edits), `BlockedSlot` (defined and read, but **still has no write path
anywhere in the codebase** — the table can only ever be empty), and
`AdminWhitelist` (`owner`/`rental_manager`/`member`, plus a permanently
orphaned unused `approver` value Postgres can't drop without recreating
the enum type).

**Tests** (`test/`) — `node --test` (no new dependency), scoped to exactly
the round-trip and overlap math that would have caught the timezone bug:
`lib/jalaali.js` and `lib/availability.js`. Nothing else has coverage.
Run with `npm test`.

## Database status — read this before touching prisma/migrations

- Provider: **Neon**, not Supabase (despite `schema.prisma`'s top comment
  listing both as brief-allowed options — Supabase was never actually
  used; see the git history around 2026-09-14 if you want the full
  back-and-forth on this).
- The latest migration,
  `20260914120000_add_confirmed_booking_exclusion_constraint`, **has not
  been applied to any database as of this commit.** It adds a Postgres
  `EXCLUDE` constraint (`bookings_no_overlap_confirmed`, via
  `btree_gist`) preventing two `confirmed` bookings for the same space
  from ever having overlapping time ranges — the DB-level backstop for
  the confirm-race window described in `docs/AUDIT.md` finding #5. The
  matching code change (`handleConfirm` in `telegram-webhook.js`) is
  already live and will just never hit its new catch branch until the
  migration is actually run. Before running it anywhere real: apply it to
  a Neon branch first and confirm (a) the raw SQL is valid — it's never
  been linted against a live Postgres instance, and (b) the exact Prisma
  error shape for a violation matches what `handleConfirm` checks for
  (`err.code === 'P2004'` or a constraint-name substring match — written
  defensively for both, but neither has been observed against a real
  violation yet).
- No permanent staging environment exists. Testing changes safely means
  standing up a throwaway Neon branch (Neon → your project → Branches →
  Create branch) each time, pointing a temporary `DATABASE_URL` at it, and
  discarding it after.

## How to run this

```bash
npm install
cp .env.example .env   # fill in real values -- see the file for what each one is
npx prisma migrate deploy   # NOT `migrate dev` against production -- see DB status above
npx prisma db seed          # only on a fresh/empty database; seeds spaces + the first owner
netlify dev                 # or deploy to Netlify and set the same env vars there
```

Register the Telegram webhook once deployed:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<site>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Run the test suite: `npm test`.

## Known gaps

Full list, ranked by severity, lives in `docs/AUDIT.md` — don't let this
section drift out of sync with it; if you fix something, update the audit
doc's finding, not just here. As of this commit, still open: no rate
limiting beyond the basic IP/phone throttle already shipped; `BlockedSlot`
has no write path (no way to manually block a slot for
maintenance/cleaning); `Booking.adminActionBy` stores a mutable display
label rather than a stable id (schema comment says "chat id or username,"
code stores the label); no CI running `npm test` automatically on push;
`GET /api/bookings?reference_code=` is fully implemented but unused by
the frontend.

## Data handling

See `docs/OWNER_MANUAL.md` for the plain-language version. Technically:
customer `name`/`phone`/`email`/`notes` are stored in `bookings` in
plaintext, indefinitely — there's no automatic deletion or archival job
anywhere in this codebase. If a retention policy is ever decided on, it
needs to be built; nothing here enforces one today.
