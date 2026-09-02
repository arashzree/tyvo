const { PrismaClient } = require('@prisma/client');
const { parseJalaaliMonthParam, dateFromJalaaliDateTime, jalaaliMonthLength } = require('../../lib/jalaali');
const { computeMonthAvailability } = require('../../lib/availability');

const prisma = new PrismaClient();

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const spaceId = event.queryStringParameters && event.queryStringParameters.id;
  const monthParam = event.queryStringParameters && event.queryStringParameters.month;

  if (!spaceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing space id' }) };
  }

  let jy, jm;
  try {
    ({ jy, jm } = parseJalaaliMonthParam(monthParam));
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space || !space.active) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Space not found' }) };
    }

    // Fetch the whole Jalali month's range in Gregorian/UTC for the DB query.
    const daysInMonth = jalaaliMonthLength(jy, jm);
    const rangeStart = dateFromJalaaliDateTime(jy, jm, 1, 0, 0);
    const rangeEnd = new Date(dateFromJalaaliDateTime(jy, jm, daysInMonth, 23, 59).getTime() + 60 * 1000);

    const [confirmedBookings, blockedSlots] = await Promise.all([
      prisma.booking.findMany({
        where: {
          spaceId,
          status: 'confirmed', // per §2/§4 — only CONFIRMED bookings affect availability
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.blockedSlot.findMany({
        where: {
          spaceId,
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const days = computeMonthAvailability({ jy, jm, confirmedBookings, blockedSlots });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId, jalaaliYear: jy, jalaaliMonth: jm, days }),
    };
  } catch (err) {
    console.error('[availability] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
