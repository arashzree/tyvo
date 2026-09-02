const { Bot, webhookCallback } = require('grammy');
const { PrismaClient } = require('@prisma/client');
const { isSlotFree } = require('../../lib/availability');
const { editMessageText, answerCallbackQuery } = require('../../lib/telegram');
const { sendConfirmedSms, sendRejectedSms } = require('../../lib/kavenegar');
const {
  formatJalaaliDateTime,
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

/** Confirm / reject inline button taps. callback_data format: "confirm:<bookingId>" or "reject:<bookingId>". */
bot.on('callback_query:data', async (ctx) => {
  const [action, bookingId] = ctx.callbackQuery.data.split(':');
  if (action !== 'confirm' && action !== 'reject') return;

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

exports.handler = webhookCallback(bot, 'lambda', {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});
