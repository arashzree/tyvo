# Tyvo Booking System — Owner's Manual

This is written for the business owner, not a developer. No code, no
technical jargon you don't need. If something here doesn't match what
you're actually seeing, that's a sign this document has gone out of date
— ask your developer to update it rather than guessing.

---

## What this system is, in plain terms

Customers book studio time on the website. Every new booking request gets
sent to your Telegram — you (the owner) see it, and so does your rental
manager, who's the one who taps **✅ تأیید** (confirm) or **❌ رد**
(reject). Once confirmed, the customer gets a text message confirming
their booking; if rejected, they get a neutral text letting them know.

You never approve or reject bookings yourself — that's deliberately the
rental manager's job. What you *can* do is see everything, and manage who
has access to the system at all.

## Your role: what you can do

Message the bot `/whoami` any time to check what role Telegram thinks you
have. As an owner, you can:
- See every booking request, confirmed booking, and the full 14-day
  calendar (`/today`, `/calendar`).
- Add or remove people from the system (`/addadmin`, `/addmember`,
  `/removeadmin`, `/setrole`) — or just use the buttons under the message
  box, they do the same thing.
- **You cannot confirm or reject bookings.** If you tap a confirm/reject
  button, the bot will tell you it's not your job — that's intentional,
  not a bug.

## Adding staff

Regular staff (who should only see free/busy times, never customer
names or phone numbers) get added automatically the moment they join your
private "TyvoRentalSup" Telegram group — no command needed. If someone was
already in that group *before* this automatic system started, or if you
ever need to add someone without putting them in the group, use
**`/addmember`** followed by their numeric Telegram ID.

To get someone's numeric ID: have them message **@userinfobot** on
Telegram (a free, widely-used utility bot) — it replies instantly with
their ID number. That's the number you give the bot, never their name or
username.

Adding another owner or a rental manager (there should only ever be 2
owners and 1 rental manager at a time) works the same way, via
`/addadmin`, but that command asks for a role too since getting it wrong
matters more.

## When SMS confirmation texts stop working

Booking confirmation/rejection texts go out through a service called
Kavenegar. Kavenegar requires the exact wording of these texts to be
pre-approved through their own control panel before they'll send — this
is a Kavenegar requirement, not something built into this project.

If confirmation texts stop going out, or you're told a "template" needs
re-approval:
1. Log into your Kavenegar panel (your developer or whoever originally
   set up the account has these credentials).
2. Find the message templates for "confirmed" and "rejected" and check
   their approval status. If either was rejected or expired, resubmit the
   exact wording (don't change it without checking with your developer —
   the system expects the text in a specific format).
3. Once Kavenegar approves it, **tell your developer the approval is
   done.** They'll need to plug the newly-approved template names into
   the system's settings on your hosting provider (Netlify) — that part
   is technical and isn't something to do yourself.

If a confirm/reject ever fails to send its text message, the rental
manager who tapped the button gets told immediately in the chat, with the
customer's phone number, so they can call the customer directly as a
fallback. Nothing silently fails without someone finding out.

## If the staff Telegram group changes

Telegram occasionally upgrades a group into something called a
"supergroup" automatically (usually once it gets large enough, or certain
settings change) — and when that happens, the group gets a brand new ID
number behind the scenes. If this happens, **the bot will automatically
send you (every owner) a direct message with the new ID number and
exactly what to do with it.**

When you get that message:
1. Log into **Netlify** (your hosting provider) — your developer can give
   you access if you don't have it.
2. Find **Site settings → Environment variables**.
3. Find the variable named `TYVO_GROUP_ID` and replace its value with the
   new number the bot gave you.
4. Save, and trigger a new deploy (or just wait — it may pick up on the
   next automatic one).

If you're not comfortable doing this yourself, forward the bot's DM to
your developer and ask them to make the change — it takes them under a
minute.

## Emergency: nobody can access the bot at all

This should never happen under normal use, but if it ever does — the
system has zero owners, zero rental managers, and zero members in its
whitelist, and *everyone* gets told "این بات خصوصی است." (this bot is
private) no matter what they type, including you — **this is not
something you can fix yourself.** There's no command that can rescue this
situation from inside Telegram, by design (otherwise anyone could).

What to do: contact your developer immediately and give them two things:
1. Your own numeric Telegram ID (get it from @userinfobot, same as
   above).
2. A clear description of what happened, if you know (e.g., "we think the
   database was accidentally reset").

Your developer will need direct database access to manually re-add you as
the first owner — this is a deliberate safety design, not an oversight,
since the alternative (a bootstrap command anyone could run) would be a
much bigger risk the rest of the time.

## What happens to customer data, and for how long

Every booking stores the customer's name, phone number, and — if they
gave one — email and any notes they left. This is currently kept
**indefinitely** — there is no automatic deletion, archiving, or "forget
this customer" process anywhere in the system today. If you want a
retention policy (e.g., "delete bookings older than 2 years"), that
doesn't exist yet and would need to be built — ask your developer.

Only owners and the rental manager ever see this information. Regular
staff (`member` role) only ever see whether a time slot is free or
booked, never who booked it or their contact details. This is enforced
by the system itself, not just a policy — a staff member has no command
that can show them customer details, by design.

If your business is subject to any data-protection or privacy
requirements (this varies by where your customers and business are
based), that's a legal question worth checking with someone qualified —
this document only describes what the system technically does with the
data, not what you're required to do with it.

## Backups

Your database is hosted on Neon, which keeps its own automatic backup
history for some number of recent days — exactly how many depends on
your specific Neon plan, and isn't something this document can state
reliably without checking your account directly. **Ask your developer to
confirm your current Neon plan's backup/restore window**, and whether
it's enough for your comfort (a small, local business might reasonably
want more than the free tier gives you — that's a business decision, not
a technical one).

Beyond what Neon does automatically, nothing else in this project backs
up your data on any schedule. If that matters to you, it's worth asking
your developer to set up a periodic export as a supplement, not just
relying on the hosting provider's default.

## Quick reference: who to call for what

- **Confirmation texts not sending** → check Kavenegar template approval
  first (above), then your developer.
- **Group ID changed / bot DMed you about a migration** → follow the
  steps above, or forward the DM to your developer.
- **Nobody can use the bot at all** → your developer, immediately, with
  your Telegram ID.
- **Want to change what data is kept or for how long** → your developer,
  it needs to be built.
- **Anything that doesn't match this document** → ask your developer to
  update it, don't assume the document or the system is wrong on its own.
