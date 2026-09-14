# Tyvo Bot — UX Reference

Describes only the user-facing wording, emoji, and layout conventions the
bot actually uses today, as verified against `netlify/functions/telegram-webhook.js`
and `lib/notifications.js`. Same posture as `docs/BOT_SPEC.md`: current
state only, not a design wishlist. Written to give any new UX addition
(e.g. the persistent reply keyboard) something real to stay consistent with.

---

## 1. Command inventory, by role

Every command is gated by the whitelist (`telegram-webhook.js:79-92`) plus,
where noted, a role check. `/start`'s menu (`:95-123`) is the only place
today that already renders a role-filtered command list — this is the
reference for what a given role can actually do.

| Command | Emoji | `/start` label (fa) | Role gate | Needs args to complete? |
|---|---|---|---|---|
| `/start` | 🔄 | بازنشانی | any whitelisted | no |
| `/whoami` | 🪪 | مشخصات من | any whitelisted | no |
| `/available` | 🟢 | اسلات‌های آزاد یک فضا | any whitelisted | optional — bare call shows a space picker list |
| `/today` (alias `/upcoming`) | 📅 | رزروهای ۴۸ ساعت آینده | `owner`, `rental_manager` (blocked for `member`) | no |
| `/calendar` | 🗓️ | تقویم ۱۴ روزه | `owner`, `rental_manager` (blocked for `member`) | no |
| `/addadmin` | ➕ | افزودن ادمین (owner/rental_manager) | `owner` only | yes — `<chat_id> <role>`, bare call shows usage |
| `/addmember` | 👤 | افزودن عضو | `owner` only | yes — `<chat_id>`, bare call shows usage |
| `/removeadmin` | ➖ | حذف | `owner` only | yes — `<chat_id>`, bare call shows usage |
| `/setrole` | 🔧 | تغییر نقش | `owner` only | yes — `<chat_id> <role>`, bare call shows usage |

Confirm/reject (`✅ تأیید` / `❌ رد`) are inline-keyboard buttons attached to
a specific booking notification, not standalone commands — they don't
appear in `/start`'s menu and aren't part of this inventory.

## 2. Per-role visibility (from `/start`, `telegram-webhook.js:95-123`)

- **`member`**: `/start`, `/whoami`, `/available` only. `/today`/`/calendar`
  are actively blocked with a reply (`'این دستور برای اعضا در دسترس نیست.'`)
  if a member runs them directly, not just hidden from the menu.
- **`rental_manager`**: everything `member` gets, plus `/today`, `/calendar`.
  No access to `/addadmin`/`/addmember`/`/removeadmin`/`/setrole` — these
  reply `'این دستور فقط برای مدیران است.'` if run directly.
- **`owner`**: everything `rental_manager` gets, plus all four admin-
  management commands.

## 3. Emoji conventions

Emoji are reused consistently for the same concept across every message
template (`lib/notifications.js`) and command reply — a new UI element
should draw from this table rather than invent new meanings:

| Emoji | Meaning | Where used |
|---|---|---|
| 🔄 | reset / restart | `/start` |
| 🪪 | identity / "who am I" | `/whoami` |
| 🟢 | open / available slot | `/available`'s open-slots header |
| 🔴 | fully booked | `/available`'s no-slots-open message |
| 📅 | near-term booking list | `/today`, new-booking notification header |
| 🗓️ | longer-range calendar | `/calendar` |
| ➕ | add | `/addadmin` |
| 👤 | a person / member | `/addmember` |
| ➖ | remove | `/removeadmin` |
| 🔧 | modify / settings | `/setrole` |
| ✅ | confirm / success | confirm button, confirmed-edit header |
| ❌ | reject / failure | reject button, rejected-edit header |
| ⚠️ | warning | conflict warning, auto-flag header, SMS-failure notices |
| 📩 | new incoming request | new-booking notification header |
| ⏳ | pending status | `/calendar` status label |
| ☑️ | completed status | `/calendar` status label (unreachable today — no code path sets `completed`, see `docs/AUDIT.md`) |
| 🛑 | internal bot error | the error-boundary owner DM (`badbcd0`) |

## 4. Formatting conventions

- Farsi throughout for all user-facing text; command names and numeric ids
  (`chat_id`s, reference codes) stay in Latin — never transliterated.
- `<b>` for space names and section headers.
- Farsi digits (۰-۹) via `toFaDigits()` for anything shown to a human
  (dates, times); raw Latin digits only in machine-facing values like
  `callback_data` and reference codes.
- Section headers use a consistent `📅 <b>Title</b>` (emoji + bold) pattern;
  day-group headers in `/calendar`/`/available` use a `── {header} ──` bar.

## 5. Message & interaction rules

These are the standard every message/keyboard should follow — including
new ones (e.g. the persistent reply keyboard). Each is checked against
what the code actually does today; where they don't match, that's a real
gap, called out rather than smoothed over, same as `docs/AUDIT.md`.

**Message structure**: emoji + bold title, blank line, body, blank line,
trailing metadata, with any actions as a separate inline keyboard (not
text). Followed consistently — every template in `lib/notifications.js`
matches this shape (e.g. `buildConfirmedEditText`: `✅ <b>تأیید شد</b>` /
blank / body lines / blank / `کد رهگیری:` + `توسط:`).

**Emoji**: one in the title, one per list item, never inside a sentence.
Titles: followed everywhere. List items: **not fully followed** —
`/today`'s booking lines (`telegram-webhook.js:~146`) use a bare `•` with
no emoji at all; `/calendar`'s lines do carry one via the trailing status
label (`⏳`/`✅`/`❌`/`☑️`), but that's incidental to the status, not a
deliberate per-item marker. Worth fixing if `/today` is touched again.

**HTML parse mode only, never Markdown** — safer with Farsi (Markdown's
`_`/`*`/`` ` `` collide with Farsi punctuation and RTL text far more than
HTML entities do). Followed 100% — every `parse_mode` in the codebase is
`'HTML'` (`lib/telegram.js:30,38`); nothing uses `Markdown`/`MarkdownV2`.

**IDs, times, and commands wrapped in `<code>`** so they're tap-to-copy
and render LTR inside RTL text. **Partially followed**: reference codes
and phone numbers are always wrapped (confirmed everywhere in
`lib/notifications.js`). Booking times are **not** — `formatJalaaliDateTime`'s
output is spliced into `تاریخ و ساعت: {jalaaliDateTime}` as plain text,
unwrapped. Command names in usage hints are unwrapped too, because those
specific replies don't set `parse_mode` at all (see next point) — so
`<code>` isn't even available to them today.

**Usage hints must show a complete copy-ready example, not `<chat_id>`
placeholders.** Mixed compliance, checked directly against the four admin
commands:
- `/available` (`:303`) — fully compliant: bare call lists real, tappable
  space slugs, no placeholder pattern at all.
- `/addadmin` (`:366`) and `/addmember` (`:396`) — partially compliant:
  each *does* include a concrete `مثال:` line with a real chat_id, but the
  line above it still leads with the abstract `<chat_id> <role>` pattern,
  and since neither reply sets `parse_mode`, that abstract line can't even
  be `<code>`-wrapped to visually distinguish it from the copy-ready
  example.
- `/removeadmin` (`:422`) and `/setrole` (`:462`) — **not compliant**: only
  the abstract placeholder line, no concrete example at all.

**Inline buttons: max 2 columns, destructive left, primary right, same
wording for the same action everywhere.** Two real gaps here:
- Confirm/reject (`bookings.js:144-146`): array order is confirm (✅) then
  reject (❌) — primary first, destructive second. That's the reverse of
  "destructive left, primary right" under the usual assumption that array
  order maps to left-to-right screen position (Telegram inline keyboards
  are UI chrome and aren't guaranteed to mirror for RTL chats the way
  message text does, so this is worth confirming visually before
  "fixing" it, but as written the code does not follow the stated rule).
- Wording is **not** consistent for the same action: the original
  notification's reject button says `❌ رد`, but the auto-flag button
  (`telegram-webhook.js:592`, sent when another pending request needs
  rejecting after a slot fills) says `❌ رد این درخواست` — different text
  for the same `reject:{id}` action.

**Error messages: what happened, why, what to do — never just "خطا."**
Mostly followed. Good example: the SMS-failure notice (`handleConfirm`) —
"رزرو تأیید شد ولی پیامک ارسال نشد. لطفاً با مشتری تماس بگیرید: {phone}"
covers all three. Weakest example: the global error-boundary message
(`badbcd0`, `handleUncaughtError`) — "خطایی رخ داد. لطفاً دوباره تلاش
کنید." states *that* something happened and *what to do* (retry), but
deliberately omits *why*, since the underlying cause (a Prisma hiccup, a
Telegram API failure, anything) isn't something safe or useful to surface
to whoever triggered it. That's a considered exception, not an oversight
— but flagging it here so it doesn't get cited as a violation without
context.

**No tables in Telegram — list items as text blocks, not grids.**
Followed: no template renders anything grid-like. (This rule is about
messages the bot *sends*; it does not apply to this document's own use of
Markdown tables in §1/§3 above, which render in a repo/markdown viewer,
not in Telegram.)
