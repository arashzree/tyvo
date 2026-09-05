const { Bot, webhookCallback } = require('grammy');
const { PrismaClient } = require('@prisma/client');
const { isSlotFree } = require('../../lib/availability');
const { editMessageText, answerCallbackQuery } = require('../../lib/telegram');
const { sendConfirmedSms, sendRejectedSms } = require('../../lib/kavenegar');
const {
  formatJalaaliDateTime,
  formatJalaaliDayHeader,
  formatJalaaliTime,
  buildConfirmedEditText,
  buildRejectedEditText,
  buildAutoFlagText,
} = require('../../lib/notifications');

const prisma = new PrismaClient();
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

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

/** §7 — /today (and /upcoming) lists confirmed bookings for the next 48h. */
bot.command(['today', 'upcoming'], async (ctx) => {
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

/** Any admin (owner or approver) — just the whitelist gate above, no role restriction. */
bot.command('whoami', async (ctx) => {
  const roleLabel = ctx.adminRole === 'owner' ? 'مدیر (owner)' : 'مسئول رنتال (approver)';
  await ctx.reply(`شما: ${escapeHtml(ctx.adminLabel)}\nنقش: ${roleLabel}`);
});

/** Any admin (owner or approver) — same access level as /whoami, lists the next 14 days grouped by day. */
bot.command('calendar', async (ctx) => {
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

/** owner only — add or update an admin's label/role. */
bot.command('addadmin', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const tokens = (ctx.match || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    await ctx.reply('استفاده صحیح: /addadmin <chat_id> <name> <role>\nrole باید owner یا approver باشد.');
    return;
  }
  const chatId = tokens[0];
  const role = tokens[tokens.length - 1];
  const name = tokens.slice(1, -1).join(' ');
  if (role !== 'owner' && role !== 'approver') {
    await ctx.reply('استفاده صحیح: /addadmin <chat_id> <name> <role>\nrole باید owner یا approver باشد.');
    return;
  }

  await prisma.adminWhitelist.upsert({
    where: { chatId },
    update: { label: name, role },
    create: { chatId, label: name, role },
  });
  await ctx.reply(`✅ ${escapeHtml(name)} با نقش ${role} اضافه شد.`);
});

/** owner only — remove an admin, refusing if it would remove the last remaining owner. */
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

  await prisma.adminWhitelist.delete({ where: { chatId } });
  await ctx.reply('✅ ادمین حذف شد.');
});

/** owner only — change an admin's role, with the same last-owner safety check as /removeadmin. */
bot.command('setrole', async (ctx) => {
  if (ctx.adminRole !== 'owner') {
    await ctx.reply('این دستور فقط برای مدیران است.');
    return;
  }

  const tokens = (ctx.match || '').trim().split(/\s+/).filter(Boolean);
  const [chatId, role] = tokens;
  if (!chatId || !role || (role !== 'owner' && role !== 'approver')) {
    await ctx.reply('استفاده صحیح: /setrole <chat_id> <role>\nrole باید owner یا approver باشد.');
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

  await prisma.adminWhitelist.update({ where: { chatId }, data: { role } });
  await ctx.reply('✅ نقش به‌روزرسانی شد.');
});

/** Confirm / reject inline button taps. callback_data format: "confirm:<bookingId>" or "reject:<bookingId>". */
bot.on('callback_query:data', async (ctx) => {
  const [action, bookingId] = ctx.callbackQuery.data.split(':');
  if (action !== 'confirm' && action !== 'reject') return;

  // Defense in depth: owners no longer receive these buttons (Step 3), but
  // reject explicitly anyway rather than relying only on that.
  if (ctx.adminRole !== 'approver') {
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
    await ctx.reply(`⚠️ رزرو تأیید شد ولی ارسال پیامک ناموفق بود (${updated.referenceCode}).`);
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
