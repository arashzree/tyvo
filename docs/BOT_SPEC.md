# Tyvo Bot & Backend — Current-State Spec

Describes only what the code does today, as of this file's writing. All citations are `file:line`. No intended/planned behavior is described unless explicitly marked INCOMPLETE.

Bot framework: grammy `^1.27.0` (`package.json:12`). Bot entry point: `netlify/functions/telegram-webhook.js`.

---

## 1. Whitelist gate (applies to every update)

`netlify/functions/telegram-webhook.js:19-30`

Runs before every command and callback handler. Looks up `AdminWhitelist` by `String(ctx.chat.id)` (`:20-21`). If no row exists:
- For a message update: replies `این بات خصوصی است.` (`:23`)
- For a callback query: `ctx.answerCallbackQuery({ text: 'این بات خصوصی است.', show_alert: true })` (`:24`)
- Returns without calling `next()` — no handler below this point ever runs for a non-admin (`:25`)

If a row exists, sets `ctx.adminLabel = admin.label || chatId` and `ctx.adminRole = admin.role` (`:27-28`) for use by every handler below.

---

## 2. Command handlers

### `/start`
`telegram-webhook.js:33-53` · caller: any admin (owner or approver)

Sends a fixed menu, role-dependent. Exact text sent (owner):
```
سلام {adminLabel} 👋

دستورات عمومی:
🔄 بازنشانی → /start
🪪 مشخصات من → /whoami
📅 رزروهای ۴۸ ساعت آینده → /today
🗓️ تقویم ۱۴ روزه → /calendar

دستورات مدیریتی:
➕ افزودن ادمین → /addadmin
➖ حذف ادمین → /removeadmin
🔧 تغییر نقش → /setrole
```
For an approver, only the text through `/calendar` is sent — the `دستورات مدیریتی` block (`:44-49`) is omitted. Plain text, no `parse_mode` (`:52`). `adminLabel` is HTML-escaped via the local `escapeHtml` (`:332-334`) even though this call has no `parse_mode`, so any `&`/`<`/`>` in a label would show as literal `&amp;` etc.

### `/today`, `/upcoming` (same handler, two aliases)
`telegram-webhook.js:56-74` · caller: any admin

Queries `Booking` where `status: 'confirmed'` and `startAt` within now..+48h (`:57-63`), ordered ascending, including `space`.

- No results: replies `📭 هیچ رزرو تأییدشده‌ای برای ۴۸ ساعت آینده نیست.` (`:66`)
- Results: `parse_mode: HTML` (`:73`), one line per booking:
  ```
  📅 <b>رزروهای ۴۸ ساعت آینده</b>

  • <b>{space.nameFa}</b> — {jalaaliDateTime} — {customerName} (<code>{referenceCode}</code>)
  ```
  (`:70-73`, date formatted via `formatJalaaliDateTime` from `lib/notifications.js:6-12`)

`/upcoming` is a fully working alias (`:56`) but is not listed in `/start`'s menu — see §5.

### `/whoami`
`telegram-webhook.js:77-80` · caller: any admin

```
شما: {adminLabel}
نقش: {مدیر (owner) | مسئول رنتال (approver)}
```
Plain text, no `parse_mode`.

### `/calendar`
`telegram-webhook.js:83-124` · caller: any admin

Queries `Booking` where `status: { not: 'cancelled' }` and `startAt` within now..+14d (`:84-90`), grouped by Jalali day header (`formatJalaaliDayHeader`, `lib/notifications.js:15-19`).

- No results: `هیچ رزروی برای ۱۴ روز آینده ثبت نشده.` (`:93`)
- Results, `parse_mode: HTML` (`:122`):
  ```
  📅 <b>تقویم رزروها (۱۴ روز آینده)</b>

  ── {dayHeader} ──
  • {space.nameFa} — {time} — {customerName} (<code>{referenceCode}</code>) — {statusEmoji+label}
  ```
  Status labels (`:97-102`): `pending`→`⏳ در انتظار`, `confirmed`→`✅ تأییدشده`, `rejected`→`❌ ردشده`, `completed`→`☑️ انجام‌شده`. `cancelled` is excluded by the query itself so it never reaches this map. `completed` is in the map but never assigned by any code — see §5.

### `/addadmin <chat_id>`
`telegram-webhook.js:127-156` · caller: owner only (`:128-131`, else `این دستور فقط برای مدیران است.`)

Parses the first whitespace-separated token as `chat_id`; must match `/^-?\d+$/` (`:133-134`), else:
```
استفاده صحیح: /addadmin <chat_id>
مثال: /addadmin 268537670
(شناسه عددی چت را می‌توانید از رباتی مثل @userinfobot بگیرید)
```
Attempts `ctx.api.getChat(chatId)` to derive a label from `first_name`/`last_name`/`username`, falling back to the bare `chatId` string on any error, including the target never having started a chat with the bot (`:139-145`).

- If `chatId` already exists in `AdminWhitelist`: updates only `label`, leaves `role` untouched, replies `ℹ️ {label} از قبل ادمین است (نقش: {role}). نام به‌روزرسانی شد.` (`:148-151`)
- Otherwise: creates the row with `role: 'approver'` (hardcoded — there is no way to create an `owner` via this command) and replies `✅ {label} به‌عنوان ادمین (مسئول رنتال) اضافه شد.` (`:154-155`)

### `/removeadmin <chat_id>`
`telegram-webhook.js:159-187` · caller: owner only (else `این دستور فقط برای مدیران است.`)

- No `chat_id` given: `استفاده صحیح: /removeadmin <chat_id>` (`:167`)
- Not in whitelist: `این شناسه در لیست ادمین‌ها نیست.` (`:173`)
- Target is the last remaining `owner`: refuses, `امکان حذف آخرین مدیر وجود ندارد.` (`:178-182`)
- Otherwise: deletes the row, `✅ ادمین حذف شد.` (`:186`)

### `/setrole <chat_id> <role>`
`telegram-webhook.js:190-219` · caller: owner only (else `این دستور فقط برای مدیران است.`)

- Missing/invalid args (`role` must be exactly `owner` or `approver`): `استفاده صحیح: /setrole <chat_id> <role>\nrole باید owner یا approver باشد.` (`:199`)
- Not in whitelist: `این شناسه در لیست ادمین‌ها نیست.` (`:205`)
- Would demote the last remaining owner: refuses, `امکان تغییر نقش آخرین مدیر به مسئول رنتال وجود ندارد.` (`:211-214`)
- Otherwise: updates `role` (`:217`), replies `✅ نقش به‌روزرسانی شد.` (`:218`)

---

## 3. Callback query handler (inline buttons)

### `bot.on('callback_query:data')`
`telegram-webhook.js:222-248` · single handler for all `callback_data` values

Parses `callback_data` as `"{action}:{bookingId}"` (`:223`). Only `confirm` and `reject` are recognized; any other action string is silently ignored — `return` with no reply at all (`:224`).

Permission: caller must have `ctx.adminRole === 'approver'`; owners (or any other role) get `ctx.answerCallbackQuery({ text: 'فقط مسئول رنتال می‌تواند این کار را انجام دهد.', show_alert: true })` (`:228-231`).

Then:
- Booking not found: `این رزرو دیگر وجود ندارد.` (`:235`)
- Booking not `pending`: `این درخواست قبلاً پردازش شده ({status}).` (`:239`)
- `action === 'confirm'` → `handleConfirm(ctx, booking)` (`:243-244`)
- `action === 'reject'` → `handleReject(ctx, booking, { silent: false })` (`:245-246`)

**`confirm:{bookingId}`** (label `✅ تأیید`, created in `bookings.js:133`) → `handleConfirm` (`telegram-webhook.js:250-307`):
1. Re-checks the slot is still free of any other `confirmed` booking (`:252-266`); if not: `⚠️ این اسلات در همین فاصله توسط رزرو دیگری تأیید شد. این درخواست را نمی‌توان تأیید کرد.` and stops.
2. Sets `status: 'confirmed'`, `adminActionBy: ctx.adminLabel`, `adminActionAt: now` (`:268-271`).
3. Edits every admin's copy of the notification (see §4) to the confirmed template, answers the callback with `تأیید شد ✅` (`:273-274`).
4. Sends the confirmed SMS (§4); on failure, replies in-chat `⚠️ رزرو تأیید شد ولی ارسال پیامک ناموفق بود ({referenceCode}).` (`:277-287`).
5. Finds any other still-`pending` booking for the same space/slot and, for each, edits all of *its* admin copies to the auto-flag template with a single `❌ رد این درخواست` button (`:289-306`) — see §5 for who actually receives this button.

**`reject:{bookingId}`** (label `❌ رد`, `bookings.js:134`; also reused for the auto-flag button, `telegram-webhook.js:303`) → `handleReject(ctx, booking, { silent })` (`:309-324`):
1. Sets `status: 'rejected'`, `adminActionBy: ctx.adminLabel`, `adminActionAt: now` (`:310-313`).
2. Edits every admin's copy to the rejected template; answers the callback with `رد شد ❌` unless `silent` is true (`:315-316`).
3. Sends the rejected SMS (§4); on failure, only `console.error` — no admin-facing message at all (`:319-323`).

---

## 4. Automatic / triggered messages

### New booking notification
Triggered from `netlify/functions/bookings.js:93` (`notifyAdmins`, `:129-154`) whenever `POST /api/bookings` creates a booking (`:78-90`). Sent to **every** row in `AdminWhitelist` (`:130`) — not filtered by role.

Template — `lib/notifications.js:30-46` (`buildNewBookingMessage`), `parse_mode: HTML` (set in `lib/telegram.js:30`):
```
[⚠️ <b>این اسلات یک درخواست دیگر هم دارد — لطفاً قبل از تأیید بررسی کنید.</b>]   ← only if hasConflict

📩 <b>درخواست رزرو جدید</b>

فضا: <b>{space.nameFa}</b>
نام: {customerName}
موبایل: <code>{customerPhone}</code>
تاریخ و ساعت: {jalaaliDateTime}
[توضیحات: {notes}]   ← only if notes present

کد رهگیری: <code>{referenceCode}</code>
```
Inline keyboard: only attached when the recipient's `role === 'approver'` (`bookings.js:139-141`) — `[[✅ تأیید, ❌ رد]]`, one row, `callback_data` = `confirm:{id}` / `reject:{id}` (`bookings.js:132-135`). Owners receive the identical text with **no buttons**.

Every send attempt (success or failure) is tracked per-admin in `Promise.allSettled` (`:137-143`); successful sends get a row in `TelegramMessage` recording `chatId`+`messageId` (`:145-153`), used later to edit that admin's copy in place.

### Confirmed edit (replaces the original notification message, all copies)
`lib/notifications.js:48-60` (`buildConfirmedEditText`), applied via `editAllCopies` (`telegram-webhook.js:327-330`) with no inline keyboard (buttons removed — `lib/telegram.js:39`):
```
✅ <b>تأیید شد</b>

فضا: <b>{space.nameFa}</b>
نام: {customerName}
موبایل: <code>{customerPhone}</code>
تاریخ و ساعت: {jalaaliDateTime}

کد رهگیری: <code>{referenceCode}</code>
توسط: {adminLabel or '—'}
```

### Rejected edit (all copies)
`lib/notifications.js:62-73` (`buildRejectedEditText`), same delivery path, buttons removed:
```
❌ <b>رد شد</b>

فضا: <b>{space.nameFa}</b>
نام: {customerName}
تاریخ و ساعت: {jalaaliDateTime}

کد رهگیری: <code>{referenceCode}</code>
توسط: {adminLabel or '—'}
```

### Auto-flag edit (other pending bookings for a slot that just got confirmed)
`lib/notifications.js:76-87` (`buildAutoFlagText`), sent via the loop at `telegram-webhook.js:301-306`:
```
⚠️ <b>این اسلات توسط رزرو دیگری تأیید شد — این درخواست را رد کنید؟</b>

فضا: <b>{space.nameFa}</b>
نام: {customerName}
موبایل: <code>{customerPhone}</code>
تاریخ و ساعت: {jalaaliDateTime}

کد رهگیری: <code>{referenceCode}</code>
```
Keyboard: single button `❌ رد این درخواست` → `callback_data: reject:{id}` (`:303`). Applied to **every** `TelegramMessage` row for that booking (`:304-305`) — i.e. every admin who was notified originally, including owners, even though owners are rejected by the permission check in §3 if they tap it. See §5.

### SMS (Kavenegar), on confirm/reject only — not sent at creation
`lib/kavenegar.js`. Both use the Verify Lookup API (`:21-35`), not free-form text — the actual wording is whatever template Kavenegar's panel has approved for `KAVENEGAR_TEMPLATE_CONFIRMED`/`KAVENEGAR_TEMPLATE_REJECTED`, not visible in this codebase.
- Confirmed (`:38-47`): tokens = space name (fa), Jalali date/time, reference code.
- Rejected (`:50-57`): token = reference code only.

See §5 — neither can currently succeed in production.

### Reminders
No reminder functionality exists anywhere in the codebase — no scheduled/cron function, no time-based follow-up message. (`netlify/functions/` contains exactly four files: `availability.js`, `bookings.js`, `spaces.js`, `telegram-webhook.js`; `netlify.toml` defines no `[functions.*]` schedule.)

### HTTP error responses (not Telegram messages, but automatic system output)
`netlify/functions/bookings.js` `POST /api/bookings` (`handleCreate`, `:17-104`):
- `400 {"error":"Invalid JSON body"}` (`:22`)
- `400 {"error":"Missing required field(s)"}` (`:29`)
- `400 {"error":"Invalid Iranian mobile number"}` (`:33`)
- `400 {"error":"Invalid email format"}` (`:36`)
- `400 {"error":"Invalid start_at"}` (`:40`)
- `400 {"error":"Bookings require at least {MINIMUM_LEAD_HOURS}h lead time"}` (`:43`, `MINIMUM_LEAD_HOURS = 12`, `lib/validate.js:26`)
- `404 {"error":"Space not found"}` (`:50`)
- `409 {"error":"Slot is no longer available"}` (`:71`)
- `500 {"error":"Internal error"}` (`:102`)

`GET /api/bookings?reference_code=` (`handleLookup`, `:106-126`):
- `400 {"error":"Missing reference_code"}` (`:109`)
- `404 {"error":"Not found"}` (`:116`)
- `500 {"error":"Internal error"}` (`:124`)

`GET /api/spaces` (`spaces.js:4-32`): `500 {"error":"Internal error"}` only (`:30`); no other error path.

`GET /api/availability` (`availability.js`): `400 {"error":"Missing space id"}` (`:16`); `400 {"error":"{message}"}` (`:23`) where message comes from `parseJalaaliMonthParam` (`lib/jalaali.js:117,120`); `404 {"error":"Space not found"}` (`:29`); `500 {"error":"Internal error"}` (`:66`).

---

## 5. Data model

Prisma schema: `prisma/schema.prisma`. Postgres.

### `Space` → table `spaces` (`:22-37`)
| field | type | notes |
|---|---|---|
| id | String @id uuid | |
| name | String | English name |
| nameFa | String → `name_fa` | |
| slug | String @unique | |
| featured | Boolean, default false | |
| tag | String? | |
| description | String | |
| active | Boolean, default true | |
| sortOrder | Int → `sort_order` | |

Relations: `bookings Booking[]`, `blockedSlots BlockedSlot[]` (`:33-34`).

### `Booking` → table `bookings` (`:39-67`)
| field | type | notes |
|---|---|---|
| id | String @id uuid | |
| referenceCode | String @unique → `reference_code` | `TYVO-XXXXXX`, generated by `lib/referenceCode.js:5-10` (6 chars from a 32-symbol no-ambiguous-character alphabet, `:3`), collision-retried up to 5 times (`lib/referenceCode.js:13-20`) |
| spaceId → space | FK → Space | |
| startAt / endAt | DateTime → `start_at`/`end_at` | UTC; `endAt = startAt + 1h` always (`bookings.js:9,45`) |
| customerName / customerPhone / customerEmail? / notes? | String | |
| status | `BookingStatus`, default `pending` | see enum below |
| createdAt / updatedAt | DateTime | |
| adminActionBy? | String → `admin_action_by` | schema comment (`:53`) says "telegram chat id or username"; actual value stored is `ctx.adminLabel` (the display label), not a chat id — see §6 |
| adminActionAt? | DateTime | |

Relation: `telegramMessages TelegramMessage[]` (`:62`). Indexes: `[spaceId, startAt]`, `[status]` (`:64-65`).

`BookingStatus` enum (`:14-20`): `pending | confirmed | rejected | cancelled | completed`. Only `pending`, `confirmed`, `rejected` are ever assigned by any code path — see §6.

### `TelegramMessage` → table `booking_telegram_messages` (`:69-78`)
One row per admin notified about a booking, so each admin's copy can be edited independently. `bookingId` FK, `chatId`, `messageId`. `@@unique([bookingId, chatId])` (`:76`).

### `BlockedSlot` → table `blocked_slots` (`:80-92`)
`spaceId` FK, `startAt`/`endAt`, `reason?`, `createdBy`, `createdAt`. Index `[spaceId, startAt]`. Read by `bookings.js:59-62` (conflict check) and `availability.js` (via `computeMonthAvailability`) — no code path anywhere creates, updates, or deletes a row. See §6.

### `AdminWhitelist` → table `admin_whitelist` (`:99-105`)
`chatId String @id` (Telegram chat id, string), `label String`, `role AdminRole`. `AdminRole` enum (`:94-97`): `owner | approver`.

Seeded once in `prisma/seed.js:45-49`: a single `owner` row (`chatId: '268537670'`, `label: 'Atilla'`) upserted alongside the 7 `Space` rows (`:14-29,34-38`) on `npx prisma db seed`.

---

## 6. Flagged INCOMPLETE

- **SMS cannot currently succeed in production.** `KAVENEGAR_API_KEY`, `KAVENEGAR_TEMPLATE_CONFIRMED`, `KAVENEGAR_TEMPLATE_REJECTED` are not set in the Netlify production environment (confirmed via `netlify env:list --context production`, which lists only `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`). `sendConfirmedSms`/`sendRejectedSms` throw immediately on the missing-API-key check (`lib/kavenegar.js:22,39,51`) every time a booking is confirmed or rejected. The confirm path surfaces this to the admin (`telegram-webhook.js:284-287`); the reject path does not — it only `console.error`s (`:321-322`), so a rejected customer silently never gets an SMS and no admin is told.

- **`BlockedSlot` has no write path.** The table is defined, migrated, and read in two places (`bookings.js:59-62`, `availability.js` via `computeMonthAvailability`), but nothing in the codebase ever creates, updates, or deletes a row — there is no command, callback, or API endpoint to block a slot. The table can only ever be empty.

- **`BookingStatus.cancelled` and `.completed` are unreachable.** Defined in the enum (`schema.prisma:14-20`) and referenced by read-side code (`/calendar`'s `not: 'cancelled'` filter, `telegram-webhook.js:87`; the `completed` → `☑️ انجام‌شده` label, `:101`), but no `prisma.booking.update`/`create` anywhere in the codebase ever sets either value. Only `pending`, `confirmed`, `rejected` are reachable.

- **Dead export/import: `answerCallbackQuery` in `lib/telegram.js:43-45,47`.** Imported into `telegram-webhook.js:4` but never called — every actual call site uses grammy's own `ctx.answerCallbackQuery(...)` instead (`:24,229,235,239,264,274,316`).

- **`handleReject`'s `silent` parameter is effectively dead.** The only call site is `telegram-webhook.js:246`, always `{ silent: false }`. The `if (!silent)` branch (`:316`) therefore always runs; the skip-path it guards against has no way to be reached, suggesting a second, non-callback call site was planned but never added.

- **Auto-flag re-adds a button to admins who aren't allowed to use it.** The original new-booking notification only gives approvers the confirm/reject buttons — owners get the same text with none (`bookings.js:139-141`). But the auto-flag update (`telegram-webhook.js:301-306`) edits *every* admin's copy, owners included, and attaches a `❌ رد این درخواست` button to all of them (`:303-305`) — an owner who taps it hits the `ctx.adminRole !== 'approver'` check (`:228-231`) and is rejected, but the button is visibly there for them regardless.

- **`GET /api/bookings?reference_code=` is implemented but unused.** `bookings.js:106-126` fully works (verified directly against production) and is reachable via the plain `/api/bookings` redirect, but no code in `public/js/` ever calls it — there is no "check my reservation" UI anywhere in the frontend.

- **`/upcoming` is a working but undocumented alias for `/today`.** Registered identically (`telegram-webhook.js:56`) but not mentioned in `/start`'s menu (`:33-53`).

- **`lib/availability.js`'s `TIME_SLOTS` export (`:14,61`) has no external consumer** — used only internally by `computeMonthAvailability` in the same file.

- **Schema/code mismatch on `Booking.adminActionBy`.** The field's comment (`schema.prisma:53`) says it stores "telegram chat id or username," but both write sites (`telegram-webhook.js:270,312`) store `ctx.adminLabel` — the human-readable label from `AdminWhitelist.label`, not a chat id.
