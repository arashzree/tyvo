# Role model gap analysis — current (owner/approver) vs. required (owner/rental_manager/member)

Analysis only. No code changed. Citations are `file:line` against the code as it exists now. Where this drifts from `docs/BOT_SPEC.md`'s line numbers (the SMS-visibility commit shifted a few lines in `telegram-webhook.js` and moved `lib/kavenegar.js` → `lib/sms.js` after that doc was written), the numbers below are current.

**Target model** (as given): `owner` (2 people, sees everything including customer details, never approves), `rental_manager` (1 person, approves/rejects, sees everything), `member` (whitelisted staff, sees free slots only, books for self, must not see who booked other slots, must not get approve/reject buttons). Whitelist is invite-only (explicit add/remove).

---

## 1. What the current two-role model actually permits

The whole system only ever checks two things: (a) *is this chat_id whitelisted at all*, and (b) *is its role exactly `'owner'`* or *exactly `'approver'`*. There is no third state, and — critically — several handlers don't check role at all, only whitelist membership.

| Command / callback | Role check | Who can actually use it today |
|---|---|---|
| `/start` | `ctx.adminRole === 'owner'` gates one extra menu block (`telegram-webhook.js:43`) | Both roles get the base menu; only `owner` gets the admin-management lines |
| `/today`, `/upcoming` | **none** | Any whitelisted chat_id, full stop |
| `/whoami` | ternary `=== 'owner' ? ... : 'مسئول رنتال (approver)'` (`:78`) | Any whitelisted chat_id — and mislabels anything that isn't literally `'owner'` as `approver` |
| `/calendar` | **none** | Any whitelisted chat_id |
| `/addadmin`, `/removeadmin`, `/setrole` | `ctx.adminRole !== 'owner'` → refused (`:128,160,191`) | `owner` only |
| `bot.on('callback_query:data')` (confirm/reject) | `ctx.adminRole !== 'approver'` → refused (`:228`) | `approver` only |
| `POST /api/bookings` → new-booking notification (`bookings.js:129-154`) | **none** | Sent to `prisma.adminWhitelist.findMany()` — literally every whitelisted row, regardless of role (`bookings.js:130`) |

So "the model" today is really: *one flag (`owner`) that unlocks whitelist management, one flag (`approver`) that unlocks the confirm/reject buttons, and everything else (booking visibility, the new-booking push, `/today`, `/calendar`) is gated by nothing but "are you whitelisted."* That last part is the whole problem for `member`.

---

## 2. Every place a `member`-level user would see or do something they shouldn't

Assume `member` is added as a bare third string in the `role` column with no other code changes (the naive path). Walking every entry point:

- **Gets the full new-booking push for every booking, system-wide.** `bookings.js:130` fetches *all* whitelist rows with no role filter, and `buildNewBookingMessage` (`lib/notifications.js:30-46`) includes customer name, phone, date/time, and reference code in the message text itself. A `member` row in `AdminWhitelist` receives this exactly like `owner`/`approver` do today. **This is the single biggest leak** — it fires automatically, with no command needed, for every booking anyone makes.
- **Sees who booked what, and their phone number, via `/today`.** No role check at all (`telegram-webhook.js:56-74`); `customerName` is in every line (`:71`).
- **Sees the same for the next 14 days, including `pending`/`rejected` internal status, via `/calendar`.** No role check (`:83-124`); `customerName` again (`:115`), plus statuses that are none of a member's business (`⏳ در انتظار`, `❌ ردشده`).
- **Would see a live, tappable `❌ رد این درخواست` button** if they happen to hold a `TelegramMessage` copy of a booking that gets auto-flagged (`telegram-webhook.js:304-308`) — a consequence of the leak above (a `TelegramMessage` row only exists for chat_ids that were sent the original notification, so this only happens *because* of the first bullet, but it's worth naming separately since it's a second exposure of the same underlying gap). Tapping it would currently be **refused** by the `!== 'approver'` check (`:228`) — so this specific path is functionally safe today, only visually/informationally leaky.
- **Gets mislabeled by `/whoami`.** The ternary at `:78` has no branch for anything but `'owner'`; a `member` is told they are `مسئول رنتال (approver)` — actively wrong, and confusing if they ever try to figure out what they're allowed to do.
- **`/start` shows them commands that don't apply to them and hides nothing that should be hidden.** They get the same "دستورات عمومی" block as an `approver` (`/today`, `/calendar`, `/whoami`) — i.e. exactly the two commands that leak everyone else's bookings (bullets above).
- **No command exists for what a member *should* be able to do.** There is no bot command anywhere that shows free/busy slots without booking details, and no bot-driven way to create a booking. (See §2a.)

### 2a. The flip side: there's nothing to grant, either

The spec says a member should be able to "see FREE slots only and book for themselves." Searching the whole bot (`telegram-webhook.js`) for anything resembling an availability check or a booking-creation command: there is none. The only places that do either of those things are:
- `GET /api/availability` (`netlify/functions/availability.js`) — public, unauthenticated, returns pure `{time, open}` booleans with no customer data. Already exactly "free slots only," but it's a website API, not a bot command.
- `POST /api/bookings` (`bookings.js:17-104`) — also public, unauthenticated, is how *any* booking (staff or public customer) is created today. It doesn't distinguish "a member booking for themselves" from "a random customer" in any way — no field ties a booking back to an `AdminWhitelist` row.

So today, a staff member can already "see free slots and book for themselves" — by using the exact same public website a customer would, which happens to be safe (no leak) purely because it was never built with any admin/staff awareness at all. Whether the target model wants that to stay a website-only flow, or wants it moved into the bot (a `/book` command, say), is an open product question, not something the current code half-implements — there is nothing to extend here, it would be new.

---

## 3. Do `/today` and `/calendar` leak customer details to non-owners, today?

**Not yet in practice, but only because no restricted role currently exists — the code itself has no mechanism preventing it.** Right now both commands are reachable by anyone whitelisted (`owner` or `approver`), and under the *current* 2-role model that's arguably fine, since the spec says `rental_manager` ("approver" today) should also "see everything." The moment a `member` row is added to `AdminWhitelist` under the existing code, both commands become a direct leak, because:
- Neither checks `ctx.adminRole` at all (`:56`, `:83`) — only the outer whitelist gate (`:19-30`) runs.
- Both hard-code `customerName` into every line (`:71`, `:115`); `/calendar` also exposes booking `status`, including `pending`/`rejected`, which is internal operational detail.

There is no partial protection to point to — it's a straight yes-once-a-member-exists.

---

## 4. What has to change

### Schema (`prisma/schema.prisma`)
- `AdminRole` enum (`:94-97`) currently `{ owner, approver }`. Needs a third value for `member`, and a decision on whether `approver` gets renamed to `rental_manager` (cosmetic, but the current name actively conflicts with the new terminology and the code's own user-facing string "مسئول رنتال" — which actually already *means* "rental manager" in Farsi, so the Farsi label is arguably already correct and it's only the English enum symbol that's stale).
- No new fields are strictly required to represent the three roles. But: nothing currently caps `owner` at 2 or `rental_manager` at exactly 1 — those are business facts enforced today only by convention (nobody's added a second owner or a second approver). If "exactly one rental_manager, always" matters operationally, the last-owner-style guard (see below) needs an equivalent for the *last remaining* `rental_manager`, which doesn't exist today in any form.
- `Booking` has no link back to `AdminWhitelist` (`schema.prisma:39-67`) — there's no way to record "this booking was self-made by member X" versus an ordinary public customer booking. Not required by the stated spec, but worth flagging since "book for themselves" implies the system might eventually want to know *which* member a booking belongs to.

### Permission checks, handler by handler (`netlify/functions/telegram-webhook.js` unless noted)
- **`bookings.js:129-154` (`notifyAdmins`)** — highest priority. Must filter to `owner` + `rental_manager` only before sending the new-booking push; `member` rows must never receive it. This one change also closes the downstream `TelegramMessage`-copy leaks (§2, auto-flag bullet) for free, since those loops only ever touch chat_ids that received the original notification.
- **`/today` (`:56-74`) and `/calendar` (`:83-124`)** — currently ungated. Must either refuse `member` outright, or (if members should have *some* schedule visibility) be replaced by a member-safe variant that selects only `startAt`/`endAt`/`status` and never `customerName`/`customerPhone`. As written today there is no safe way to show these exact commands to a member — the leak is baked into the query's `select`/`include` and the message template, not just the permission gate.
- **`/whoami` (`:77-80`)** — ternary must become a real 3-way mapping (or a lookup table) instead of defaulting every non-owner to "approver."
- **`/start` (`:33-53`)** — needs a genuine 3-way menu instead of one `if (owner)` branch: a member's menu should not list `/today`/`/calendar` as they exist today, and should list whatever the eventual member-facing commands are instead.
- **`/addadmin` (`:126-156`)** — two issues: (1) it hardcodes new admins to `role: 'approver'` (`:154`) with no way to specify a role at all — under a 3-role model this default is actively dangerous, since the common case (adding a staff member) would silently grant them the "sees everything, would-be-approver" role instead of the restricted `member` role. This needs an explicit role argument (or a separate command per role) before it's safe to use for member onboarding. (2) It's owner-only, which probably stays correct (whitelist management likely shouldn't move to `rental_manager`), but that's an assumption worth confirming, not stated in the given spec.
- **`/removeadmin` (`:158-187`) and `/setrole` (`:189-219`)** — both protect against removing/demoting the *last owner* (`:177-183`, `:209-215`) but have no equivalent protection for the *last `rental_manager`*. Under a model where exactly one is supposed to exist at all times, removing or demoting them currently has zero safeguard — the business would be left with nobody able to confirm/reject bookings and no warning that happened.
- **`bot.on('callback_query:data')` (`:222-248`)** — the permission check (`:228`, `!== 'approver'`) is, encouragingly, already an *allow-list* of exactly one role rather than a deny-list, so a bare rename to `rental_manager` is a one-line change and is not itself a source of the leak. The leak is entirely upstream, in who gets notified in the first place (see `notifyAdmins` above).

### Not code, but blocking either way
- Confirm whether `rental_manager` should retain owner-management powers (`/addadmin` etc.) — the given spec doesn't say, and the current code's answer ("no, owner-only") may or may not be what's wanted going forward. **Resolved — see §5: stays owner-only.**
- Decide whether "member books for themselves" is meant to happen through the bot (new commands, none of which exist today) or through the existing public website (already safe, already free/busy-only, already live) — these are very different amounts of new work, and the current code doesn't lean either way because it was never built with a member concept at all. **Resolved — see §5: website, this phase; bot self-booking deferred to phase 2.**

---

## 5. Decisions (this phase)

Locks in answers to §4's open questions, plus the concrete command design for role assignment.

### Naming
`approver` → `rental_manager` everywhere: the `AdminRole` enum value, every `ctx.adminRole` check, every code comment/identifier. (The existing Farsi user-facing string "مسئول رنتال" already *means* "rental manager" — only the English enum symbol and internal naming were stale.) Add a third value, `member`. Three roles total: `owner`, `rental_manager`, `member`.

### Permissions (final)
| | `owner` | `rental_manager` | `member` |
|---|---|---|---|
| Sees full booking details (`/today`, `/calendar`, new-booking push) | yes | yes | **no, never** |
| Sees free/busy slots only, no names | n/a (sees everything already) | n/a (sees everything already) | yes — and *only* this |
| Gets confirm/reject buttons | **no** | yes | **no** |
| Manages the whitelist (`/addadmin`/`/addmember`/`/removeadmin`/`/setrole`) | yes | no | no |

### New-booking push (`bookings.js:130`)
Recipients narrow to whitelist rows where role is `owner` or `rental_manager`. `member` rows are excluded from the query itself, not merely denied buttons — they get nothing automatic, ever.

### `/addadmin` role handling — proposal
Split into two commands instead of one command with a required-but-easy-to-get-wrong argument:

- **`/addmember <chat_id>`** — the frequent case (onboarding staff). No role argument; always creates `role: 'member'`. Preserves the "just a chat_id" simplicity for the common, low-privilege operation.
- **`/addadmin <chat_id> <role>`** — the rare case (only 3 privileged seats exist across the whole business: 2 owners + 1 rental_manager). `role` must be exactly `owner` or `rental_manager`; passing `member` here is rejected with a message pointing at `/addmember`.

Requiring the role argument on `/addadmin` is deliberate: there is no safe default between two high-privilege roles, so it must never be implicit. `/removeadmin <chat_id>` and `/setrole <chat_id> <role>` stay as single commands covering all three roles — operating on an *already-whitelisted, known* chat_id doesn't carry the same "dangerous silent default" risk that adding a fresh one does, so splitting those too would just add commands without reducing risk.

### Last-`rental_manager` guard
`/removeadmin` and `/setrole` get the same protection already given to the last `owner` (`telegram-webhook.js:177-183`, `:209-215`), mirrored for `rental_manager`: refuse to remove or demote the sole remaining one.

### Member self-booking — deferred
Not in this phase. Members get read-only free-slot visibility in the bot only; booking still happens on the existing public website (already safe — `/api/availability` and `/api/bookings` carry no customer-identity leak by construction, per §2a). **Phase-2 candidate:** an in-bot booking flow for members, reusing the already-proven-safe availability/creation logic.
