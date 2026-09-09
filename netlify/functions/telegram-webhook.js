const { Bot, webhookCallback } = require('grammy');
const { PrismaClient } = require('@prisma/client');
const { isSlotFree, computeRangeAvailability } = require('../../lib/availability');
const { editMessageText, answerCallbackQuery } = require('../../lib/telegram');
const { sendConfirmedSms, sendRejectedSms } = require('../../lib/sms');
const {
  formatJalaaliDateTime,
  formatJalaaliDayHeader,
  formatJalaaliTime,
  toFaDigits,
  buildConfirmedEditText,
  buildRejectedEditText,
  buildAutoFlagText,
} = require('../../lib/notifications');

const prisma = new PrismaClient();
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * TEMPORARY — owner-only, replies with the current chat's id. Used once to
 * capture the group's chat_id for TYVO_GROUP_ID (see docs/ROLE_GAP.md step
 * 10); remove after that.
 *
 * Registered before the whitelist gate so it also works inside the group:
 * the gate keys off ctx.chat.id, which is the GROUP's id there (never an
 * individually-whitelisted chat_id), so it would otherwise reject this
 * before it ran. Checking ctx.from.id (the sender, not the chat) is what
 * makes the owner check work in both DMs and groups.
 *
 * Uses bot.on('message', ...) with a plain text-prefix check instead of
 * bot.command() — command-entity matching didn't fire inside the group in
 * testing (likely a bot-username-suffix/init-timing quirk specific to
 * grammy's command parsing in a serverless webhook context), so this
 * avoids that matching path entirely rather than chasing the exact cause
 * for a command that's getting deleted shortly anyway.
 */
bot.on('message', async (ctx, next) => {
  if (!(ctx.message.text || '').startsWith('/chatid')) return next();
  const sender = await prisma.adminWhitelist.findUnique({ where: { chatId: String(ctx.from && ctx.from.id) } });
  if (!sender || sender.role !== 'owner') return next();
  await ctx.reply(`<code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' });
});

/** Whitelist gate — applies to every update. Non-whitelisted users get a generic reply, no booking data leaked (brief §7). */
bot.use(async (ctx, next) => {
  const chatId = String(ctx.chat && ctx.chat.id);
  const admin = await prisma.adminWhitelist.findUnique({ where: { chatId } });
  if (!admin) {
    if (ctx.message) await ctx.reply('این بات خصوصی است.');
    else if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'این بات خصوصی است.', show_alert: true });
    return; // do not call next() — stop here for non-admins
  }
  ctx.adminLabel = admin.label || chatId;
  ctx.adminRole = admin.role;
  return next();
});

/** Entry point after the whitelist gate — greets the admin and lists commands available to their role. */
bot.command('start', async (ctx) => {
  const lines = [
    `سلام ${escapeHtml(ctx.adminLabel)} 👋`,
    '',
    'دستورات عمومی:',
    '🔄 بازنشانی → /start',
    '🪪 مشخصات من → /whoami',
    '🟢 اسلات‌های آزاد یک فضا → /available',
  ];

  if (ctx.adminRole !== 'member') {
    lines.push(
      '📅 رزروهای ۴۸ ساعت آینده → /today',
      '🗓️ تقویم ۱۴ روزه → /calendar'
    );
  }

  if (ctx.adminRole === 'owner') {
    lines.push(
      '',
      'دستورات مدیریتی:',
      '➕ افزودن ادمین (owner/rental_manager) → /addadmin',
      '👤 افزودن عضو → /addmember',
      '➖ حذف → /removeadmin',
      '🔧 تغییر نقش → /setrole'
    );
  }
  await ctx.reply(lines.join('\n'));
});

/** §7 — /today (and /upcoming) lists confirmed bookings for the next 48h. owner/rental_manager only — leaks customer names/phones, member must never see this. */
bot.command(['today', 'upcoming'], async (ctx) => {
  if (ctx.adminRole === 'member') {
    await ctx.reply('این دستور برای اعضا در دسترس نیست.');
    return;
  }

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { status: 'confirmed', startAt: { gte: now, lte: in48h } },
    orderBy: { startAt: 'asc' },
    include: { space: true },
  });

  if (bookings.length === 0) {
    await ctx.reply('📭 هیچ رزرو تأییدشده‌ای برای ۴۸ ساعت آینده نیست.');
    return;
  }

  const lines = bookings.map(
    (b) => `• <b>${escapeHtml(b.space.nameFa)}</b> — ${formatJalaaliDateTime(b.startAt)} — ${escapeHtml(b.customerName)} (<code>${b.referenceCode}</code>)`
  );
  await ctx.reply(['📅 <b>رزروهای ۴۸ ساعت آینده</b>', '', ...lines].join('\n'), { parse_mode: 'HTML' });
});

/** Any whitelisted role — just the whitelist gate above, no role restriction. */
bot.command('whoami', async (ctx) => {
  const roleLabels = {
    owner: 'مدیر (owner)',
    rental_manager: 'مسئول رنتال (rental_manager)',
    member: 'عضو (member)',
  };
  const roleLabel = roleLabels[ctx.adminRole] || ctx.adminRole;
  await ctx.reply(`شما: ${escapeHtml(ctx.adminLabel)}\nنقش: ${roleLabel}`);
});

/** owner/rental_manager only — lists the next 14 days grouped by day. Leaks customer names and internal status, member must never see this. */
bot.command('calendar', async (ctx) => {
  if (ctx.adminRole === 'member') {
    await ctx.reply('این دستور برای اعضا در دسترس نیست.');
    return;
  }

  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { status: { not: 'cancelled' }, startAt: { gte: now, lte: in14d } },
    orderBy: { startAt: 'asc' },
    include: { space: true },
  });

  if (bookings.length === 0) {
    await ctx.reply('هیچ رزروی برای ۱۴ روز آینده ثبت نشده.');
    return;
  }

  const statusLabels = {
    pending: '⏳ در انتظار',
    confirmed: '✅ تأییدشده',
    rejected: '❌ ردشده',
    completed: '☑️ انجام‌شده',
  };

  const groups = [];
  let currentHeader = null;
  let currentLines = null;
  for (const b of bookings) {
    const header = formatJalaaliDayHeader(b.startAt);
    if (header !== currentHeader) {
      currentHeader = header;
      currentLines = [];
      groups.push({ header, lines: currentLines });
    }
    currentLines.push(
      `• ${escapeHtml(b.space.nameFa)} — ${formatJalaaliTime(b.startAt)} — ${escapeHtml(b.customerName)} (<code>${b.referenceCode}</code>) — ${statusLabels[b.status] || b.status}`
    );
  }

  const sections = groups.map((g) => [`── ${g.header} ──`, ...g.lines].join('\n'));
  await ctx.reply(
    ['📅 <b>تقویم رزروها (۱۴ روز آینده)</b>', '', sections.join('\n\n')].join('\n'),
    { parse_mode: 'HTML' }
  );
});

const AVAILABLE_WINDOW_DAYS = 14; // matches /calendar's window

/** Any role, including member — shows which slots are OPEN for one space over the next 14 days. Never shows who booked, their contact info, or a reference code, not even a count — open/closed per slot only, per docs/ROLE_GAP.md's member permissions. */
bot.command('available', async (ctx) => {
  const spaces = await prisma.space.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });

  const query = (ctx.match || '').trim().toLowerCase();
  const matches = query
    ? spaces.filter(
        (s) => s.slug.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || s.nameFa.includes(query)
      )
    : [];

  if (matches.length !== 1) {
    const list = spaces.map((s) => `• ${escapeHtml(s.nameFa)} → <code>${s.slug}</code>`).join('\n');
    await ctx.reply(
      ['استفاده صحیح: /available <space>', 'یکی از این‌ها را وارد کنید:', '', list].join('\n'),
      { parse_mode: 'HTML' }
    );
    return;
  }
  const space = matches[0];

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + AVAILABLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [confirmedBookings, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: { spaceId: space.id, status: 'confirmed', startAt: { lt: rangeEnd }, endAt: { gt: now } },
      select: { startAt: true, endAt: true },
    }),
    prisma.blockedSlot.findMany({
      where: { spaceId: space.id, startAt: { lt: rangeEnd }, endAt: { gt: now } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const days = computeRangeAvailability({ days: AVAILABLE_WINDOW_DAYS, confirmedBookings, blockedSlots, now });

  const sections = days
    .map((d) => {
      const openTimes = d.slots.filter((s) => s.open).map((s) => toFaDigits(s.time));
      if (openTimes.length === 0) return null;
      return [`── ${formatJalaaliDayHeader(d.date)} ──`, openTimes.join('، ')].join('\n');
    })
    .filter(Boolean);

  if (sections.length === 0) {
    await ctx.reply(`🔴 هیچ اسلات آزادی برای <b>${escapeHtml(space.nameFa)}</b> در ۱۴ روز آینده نیست.`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(
    [`🟢 <b>اسلات‌های آزاد — ${escapeHtml(space.nameFa)}</b> (۱۴ روز آینده)`, '', sections.join('\n\n')].join('\n'),
    { parse_mode: 'HTML' }
  );
});

/** Shared by /addadmin and /addmember — resolves a chat_id to a display label via Telegram's getChat, falling back to the bare chat_id if the target hasn't started a chat with the bot yet (or getChat otherwise fails). */
async function resolveChatLabel(ctx, chatId) {
  try {
    const chat = await ctx.api.getChat(chatId);
    return [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || chatId;
  } catch {
    return chatId;
  }
}

/** owner only — add an owner or rental_manager by chat_id (e.g. from @userinfobot). role is required: there is no safe default between two high-privilege roles. Use /addmember for regular staff. */
bot.command('addadmin', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const tokens = (ctx.match || '').trim().split(/\s+/).filter(Boolean);
  const [chatId, role] = tokens;
  if (!chatId || !/^-?\d+$/.test(chatId) || !role || (role !== 'owner' && role !== 'rental_manager')) {
    await ctx.reply(
      'استفاده صحیح: /addadmin <chat_id> <role>\nrole باید owner یا rental_manager باشد.\nبرای افزودن عضو عادی از /addmember استفاده کنید.\nمثال: /addadmin 268537670 owner'
    );
    return;
  }

  const label = await resolveChatLabel(ctx, chatId);

  const existing = await prisma.adminWhitelist.findUnique({ where: { chatId } });
  if (existing) {
    await prisma.adminWhitelist.update({ where: { chatId }, data: { label } });
    await ctx.reply(`ℹ️ ${escapeHtml(label)} از قبل در لیست است (نقش: ${existing.role}). برای تغییر نقش از /setrole استفاده کنید. نام به‌روزرسانی شد.`);
    return;
  }

  await prisma.adminWhitelist.create({ data: { chatId, label, role } });
  await ctx.reply(`✅ ${escapeHtml(label)} با نقش ${role} اضافه شد.`);
});

/** owner only — add a regular staff member by chat_id alone. Always role='member'; no role argument, since member is the only safe default (see /addadmin for owner/rental_manager). */
bot.command('addmember', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const chatId = (ctx.match || '').trim().split(/\s+/).filter(Boolean)[0];
  if (!chatId || !/^-?\d+$/.test(chatId)) {
    await ctx.reply('استفاده صحیح: /addmember <chat_id>\nمثال: /addmember 268537670\n(شناسه عددی چت را می‌توانید از رباتی مثل @userinfobot بگیرید)');
    return;
  }

  const label = await resolveChatLabel(ctx, chatId);

  const existing = await prisma.adminWhitelist.findUnique({ where: { chatId } });
  if (existing) {
    await prisma.adminWhitelist.update({ where: { chatId }, data: { label } });
    await ctx.reply(`ℹ️ ${escapeHtml(label)} از قبل در لیست است (نقش: ${existing.role}). برای تغییر نقش از /setrole استفاده کنید. نام به‌روزرسانی شد.`);
    return;
  }

  await prisma.adminWhitelist.create({ data: { chatId, label, role: 'member' } });
  await ctx.reply(`✅ ${escapeHtml(label)} به‌عنوان عضو اضافه شد.`);
});

/** owner only — remove an admin, refusing if it would remove the last remaining owner or the last remaining rental_manager. */
bot.command('removeadmin', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const chatId = (ctx.match || '').trim().split(/\s+/).filter(Boolean)[0];
  if (!chatId) {
    await ctx.reply('استفاده صحیح: /removeadmin <chat_id>');
    return;
  }

  const target = await prisma.adminWhitelist.findUnique({ where: { chatId } });
  if (!target) {
    await ctx.reply('این شناسه در لیست ادمین‌ها نیست.');
    return;
  }

  if (target.role === 'owner') {
    const ownerCount = await prisma.adminWhitelist.count({ where: { role: 'owner' } });
    if (ownerCount <= 1) {
      await ctx.reply('امکان حذف آخرین مدیر وجود ندارد.');
      return;
    }
  }

  if (target.role === 'rental_manager') {
    const managerCount = await prisma.adminWhitelist.count({ where: { role: 'rental_manager' } });
    if (managerCount <= 1) {
      await ctx.reply('امکان حذف آخرین مسئول رنتال وجود ندارد.');
      return;
    }
  }

  await prisma.adminWhitelist.delete({ where: { chatId } });
  await ctx.reply('✅ ادمین حذف شد.');
});

/** owner only — change an admin's role, with the same last-owner/last-rental_manager safety checks as /removeadmin. */
bot.command('setrole', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const tokens = (ctx.match || '').trim().split(/\s+/).filter(Boolean);
  const [chatId, role] = tokens;
  if (!chatId || !role || (role !== 'owner' && role !== 'rental_manager' && role !== 'member')) {
    await ctx.reply('استفاده صحیح: /setrole <chat_id> <role>\nrole باید owner یا rental_manager یا member باشد.');
    return;
  }

  const target = await prisma.adminWhitelist.findUnique({ where: { chatId } });
  if (!target) {
    await ctx.reply('این شناسه در لیست ادمین‌ها نیست.');
    return;
  }

  if (target.role === 'owner' && role !== 'owner') {
    const ownerCount = await prisma.adminWhitelist.count({ where: { role: 'owner' } });
    if (ownerCount <= 1) {
      await ctx.reply('امکان تغییر نقش آخرین مدیر به مسئول رنتال وجود ندارد.');
      return;
    }
  }

  if (target.role === 'rental_manager' && role !== 'rental_manager') {
    const managerCount = await prisma.adminWhitelist.count({ where: { role: 'rental_manager' } });
    if (managerCount <= 1) {
      await ctx.reply('امکان تغییر نقش آخرین مسئول رنتال وجود ندارد.');
      return;
    }
  }

  await prisma.adminWhitelist.update({ where: { chatId }, data: { role } });
  await ctx.reply('✅ نقش به‌روزرسانی شد.');
});

/** Confirm / reject inline button taps. callback_data format: "confirm:<bookingId>" or "reject:<bookingId>". */
bot.on('callback_query:data', async (ctx) => {
  const [action, bookingId] = ctx.callbackQuery.data.split(':');
  if (action !== 'confirm' && action !== 'reject') return;

  // Defense in depth: owners no longer receive these buttons (Step 3), but
  // reject explicitly anyway rather than relying only on that.
  if (ctx.adminRole !== 'rental_manager') {
    await ctx.answerCallbackQuery({ text: 'فقط مسئول رنتال می‌تواند این کار را انجام دهد.', show_alert: true });
    return;
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { space: true } });
  if (!booking) {
    await ctx.answerCallbackQuery({ text: 'این رزرو دیگر وجود ندارد.', show_alert: true });
    return;
  }
  if (booking.status !== 'pending') {
    await ctx.answerCallbackQuery({ text: `این درخواست قبلاً پردازش شده (${booking.status}).`, show_alert: true });
    return;
  }

  if (action === 'confirm') {
    await handleConfirm(ctx, booking);
  } else {
    await handleReject(ctx, booking, { silent: false });
  }
});

async function handleConfirm(ctx, booking) {
  // §5.4 — race-condition re-check: slot must still be free of any OTHER confirmed booking.
  const otherConfirmed = await prisma.booking.findMany({
    where: {
      spaceId: booking.spaceId,
      status: 'confirmed',
      id: { not: booking.id },
      startAt: { lt: booking.endAt },
      endAt: { gt: booking.startAt },
    },
    select: { startAt: true, endAt: true },
  });

  if (!isSlotFree(booking.startAt, booking.endAt, otherConfirmed)) {
    await ctx.answerCallbackQuery({ text: '⚠️ این اسلات در همین فاصله توسط رزرو دیگری تأیید شد. این درخواست را نمی‌توان تأیید کرد.', show_alert: true });
    return;
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'confirmed', adminActionBy: ctx.adminLabel, adminActionAt: new Date() },
  });

  await editAllCopies(booking.id, buildConfirmedEditText({ booking: updated, space: booking.space, adminLabel: ctx.adminLabel }));
  await ctx.answerCallbackQuery({ text: 'تأیید شد ✅' });

  // §6.A — SMS only now, on confirm.
  try {
    await sendConfirmedSms({
      phone: updated.customerPhone,
      spaceNameFa: booking.space.nameFa,
      jalaaliDateTime: formatJalaaliDateTime(updated.startAt),
      referenceCode: updated.referenceCode,
    });
  } catch (err) {
    console.error('[telegram-webhook] SMS (confirmed) failed:', err);
    await ctx.reply(
      `⚠️ رزرو تأیید شد ولی پیامک ارسال نشد. لطفاً با مشتری تماس بگیرید: <code>${escapeHtml(updated.customerPhone)}</code>\nکد رهگیری: <code>${updated.referenceCode}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  // §5.5 — auto-flag (not auto-reject) any OTHER pending booking for the exact same slot.
  const otherPending = await prisma.booking.findMany({
    where: {
      spaceId: booking.spaceId,
      status: 'pending',
      id: { not: booking.id },
      startAt: { lt: booking.endAt },
      endAt: { gt: booking.startAt },
    },
    include: { space: true },
  });

  for (const pending of otherPending) {
    const text = buildAutoFlagText({ booking: pending, space: pending.space });
    const inlineKeyboard = [[{ text: '❌ رد این درخواست', callback_data: `reject:${pending.id}` }]];
    const copies = await prisma.telegramMessage.findMany({ where: { bookingId: pending.id } });
    await Promise.allSettled(copies.map((c) => editMessageText(c.chatId, c.messageId, text, { inlineKeyboard })));
  }
}

async function handleReject(ctx, booking, { silent }) {
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'rejected', adminActionBy: ctx.adminLabel, adminActionAt: new Date() },
  });

  await editAllCopies(booking.id, buildRejectedEditText({ booking: updated, space: booking.space, adminLabel: ctx.adminLabel }));
  if (!silent) await ctx.answerCallbackQuery({ text: 'رد شد ❌' });

  // §6.B — SMS only now, on reject.
  try {
    await sendRejectedSms({ phone: updated.customerPhone, referenceCode: updated.referenceCode });
  } catch (err) {
    console.error('[telegram-webhook] SMS (rejected) failed:', err);
    await ctx.reply(
      `⚠️ رزرو رد شد ولی پیامک ارسال نشد. لطفاً در صورت نیاز با مشتری تماس بگیرید: <code>${escapeHtml(updated.customerPhone)}</code>\nکد رهگیری: <code>${updated.referenceCode}</code>`,
      { parse_mode: 'HTML' }
    );
  }
}

/** Edits every admin's copy of a booking's notification message (see TelegramMessage model). */
async function editAllCopies(bookingId, text) {
  const copies = await prisma.telegramMessage.findMany({ where: { bookingId } });
  await Promise.allSettled(copies.map((c) => editMessageText(c.chatId, c.messageId, text)));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

exports.handler = webhookCallback(bot, 'aws-lambda-async', {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});
