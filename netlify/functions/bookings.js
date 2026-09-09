const { PrismaClient } = require('@prisma/client');
const { isValidIranPhone, isValidEmail, normalizeDigits, isWithinMinimumLeadTime, MINIMUM_LEAD_HOURS } = require('../../lib/validate');
const { isSlotFree } = require('../../lib/availability');
const { generateUniqueReferenceCode } = require('../../lib/referenceCode');
const { sendMessage } = require('../../lib/telegram');
const { buildNewBookingMessage } = require('../../lib/notifications');

const prisma = new PrismaClient();
const SLOT_DURATION_MS = 60 * 60 * 1000; // 1 hour, matches prototype's slot granularity

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') return handleCreate(event);
  if (event.httpMethod === 'GET') return handleLookup(event);
  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
};

async function handleCreate(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { space_id, start_at, customer_name, customer_phone, customer_email, notes } = body;

  // --- validation (brief §4: "Server-side re-validates") ---
  if (!space_id || !start_at || !customer_name || !customer_phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field(s)' }) };
  }
  const phone = normalizeDigits(customer_phone).trim();
  if (!isValidIranPhone(phone)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid Iranian mobile number' }) };
  }
  if (customer_email && !isValidEmail(customer_email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email format' }) };
  }
  const startAt = new Date(start_at);
  if (isNaN(startAt.getTime())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid start_at' }) };
  }
  if (isWithinMinimumLeadTime(startAt)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Bookings require at least ${MINIMUM_LEAD_HOURS}h lead time` }) };
  }
  const endAt = new Date(startAt.getTime() + SLOT_DURATION_MS);

  try {
    const space = await prisma.space.findUnique({ where: { id: space_id } });
    if (!space || !space.active) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Space not found' }) };
    }

    // §5.1 — slot must not already be CONFIRMED elsewhere, and not blocked.
    const [confirmedOverlaps, blockedOverlaps, otherPendingOrConfirmed] = await Promise.all([
      prisma.booking.findMany({
        where: { spaceId: space_id, status: 'confirmed', startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { startAt: true, endAt: true },
      }),
      prisma.blockedSlot.findMany({
        where: { spaceId: space_id, startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { startAt: true, endAt: true },
      }),
      // §5.3 — check for ANY other booking (pending or confirmed) on the same slot, for the conflict warning.
      prisma.booking.findMany({
        where: { spaceId: space_id, status: { in: ['pending', 'confirmed'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { id: true },
      }),
    ]);

    if (!isSlotFree(startAt, endAt, confirmedOverlaps) || !isSlotFree(startAt, endAt, blockedOverlaps)) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Slot is no longer available' }) };
    }

    const hasConflict = otherPendingOrConfirmed.length > 0; // §5.3

    const referenceCode = await generateUniqueReferenceCode(prisma);

    const booking = await prisma.booking.create({
      data: {
        referenceCode,
        spaceId: space_id,
        startAt,
        endAt,
        customerName: customer_name,
        customerPhone: phone,
        customerEmail: customer_email || null,
        notes: notes || null,
        status: 'pending',
      },
    });

    // §4 — notify all admins now; NO SMS at this stage (SMS only on confirm/reject, §6).
    await notifyAdmins({ booking, space, hasConflict });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_code: booking.referenceCode, status: booking.status }),
    };
  } catch (err) {
    console.error('[bookings:create] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}

async function handleLookup(event) {
  const referenceCode = event.queryStringParameters && event.queryStringParameters.reference_code;
  if (!referenceCode) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing reference_code' }) };
  }
  try {
    const booking = await prisma.booking.findUnique({
      where: { referenceCode },
      select: { referenceCode: true, status: true, startAt: true, endAt: true, space: { select: { name: true, nameFa: true } } },
    });
    if (!booking) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    };
  } catch (err) {
    console.error('[bookings:lookup] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}

/** Sends the new-booking notification to every owner/rental_manager admin and records each message for later in-place edits. Members never receive this — they get no automatic booking notifications at all (see docs/ROLE_GAP.md). */
async function notifyAdmins({ booking, space, hasConflict }) {
  const admins = await prisma.adminWhitelist.findMany({ where: { role: { in: ['owner', 'rental_manager'] } } });
  const text = buildNewBookingMessage({ booking, space, hasConflict });
  const inlineKeyboard = [[
    { text: '✅ تأیید', callback_data: `confirm:${booking.id}` },
    { text: '❌ رد', callback_data: `reject:${booking.id}` },
  ]];

  const results = await Promise.allSettled(
    admins.map((a) =>
      a.role === 'rental_manager'
        ? sendMessage(a.chatId, text, { inlineKeyboard })
        : sendMessage(a.chatId, text)
    )
  );

  const rows = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      rows.push({ bookingId: booking.id, chatId: admins[i].chatId, messageId: r.value.messageId });
    } else {
      console.error(`[bookings:notify] failed to notify ${admins[i].chatId}:`, r.reason);
    }
  });
  if (rows.length) await prisma.telegramMessage.createMany({ data: rows });
}
