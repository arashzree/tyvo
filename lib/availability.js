const { jalaaliMonthLength, dateFromJalaaliDateTime } = require('./jalaali');
const { isWithinMinimumLeadTime } = require('./validate');

/**
 * NOTE on slot hours: the Backend Build Brief v1 §4 says "09:00-20:00,
 * matching prototype" — but the actual approved prototype's timeSlots
 * array (booking-flow controller) is 10:00 through 20:00 (11 hourly slots,
 * no 09:00). Since the brief itself says "matching prototype" and the
 * prototype is the tested/approved source of truth, this uses the
 * prototype's real slot list. Flagging the 09:00 vs 10:00 discrepancy back
 * per the brief's own "confirm rather than guess" pattern — if Tyvo
 * actually wants a 09:00 opening slot, this is a one-line change.
 */
const TIME_SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

/**
 * Computes per-day, per-slot open/closed state for a given Jalali month.
 * DB-agnostic: callers pass in already-fetched confirmed bookings and
 * blocked slots for the relevant date range (see the Netlify function for
 * the Prisma query that supplies these).
 *
 * Per brief §2/§4: PENDING bookings do NOT affect availability — only
 * CONFIRMED bookings and blocked_slots do. Callers must only pass
 * confirmed bookings in `confirmedBookings`.
 *
 * @param {{jy:number, jm:number, confirmedBookings:Array<{startAt:Date|string,endAt:Date|string}>, blockedSlots:Array<{startAt:Date|string,endAt:Date|string}>, now?:Date}} args
 * @returns {Array<{jalaaliDay:number, slots:Array<{time:string, open:boolean}>}>}
 */
function computeMonthAvailability({ jy, jm, confirmedBookings = [], blockedSlots = [], now = new Date() }) {
  const daysInMonth = jalaaliMonthLength(jy, jm);
  const days = [];

  for (let jd = 1; jd <= daysInMonth; jd++) {
    const slots = TIME_SLOTS.map((time) => {
      const [hh, mm] = time.split(':').map(Number);
      const slotStart = dateFromJalaaliDateTime(jy, jm, jd, hh, mm);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      const tooSoon = isWithinMinimumLeadTime(slotStart, now);
      const confirmedOverlap = confirmedBookings.some((b) => overlaps(b.startAt, b.endAt, slotStart, slotEnd));
      const blockedOverlap = blockedSlots.some((b) => overlaps(b.startAt, b.endAt, slotStart, slotEnd));

      return { time, open: !tooSoon && !confirmedOverlap && !blockedOverlap };
    });
    days.push({ jalaaliDay: jd, slots });
  }

  return days;
}

/** True if the given start/end range is free of any CONFIRMED booking or blocked_slot overlap. Used by the create-booking and confirm-race-guard checks. */
function isSlotFree(startAt, endAt, existingRanges) {
  return !existingRanges.some((r) => overlaps(r.startAt, r.endAt, startAt, endAt));
}

module.exports = {
  TIME_SLOTS,
  overlaps,
  computeMonthAvailability,
  isSlotFree,
};
