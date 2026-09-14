const test = require('node:test');
const assert = require('node:assert/strict');

const { overlaps, isSlotFree, computeMonthAvailability, computeRangeAvailability } = require('../lib/availability');
const { toJalaali } = require('../lib/jalaali');

test('overlaps: partial overlap is true, disjoint ranges are false', () => {
  const aStart = '2026-09-20T10:00:00Z';
  const aEnd = '2026-09-20T11:00:00Z';
  assert.equal(overlaps(aStart, aEnd, '2026-09-20T10:30:00Z', '2026-09-20T11:30:00Z'), true, 'partial overlap should be true');
  assert.equal(overlaps(aStart, aEnd, '2026-09-20T09:00:00Z', '2026-09-20T09:30:00Z'), false, 'earlier, disjoint, should be false');
  assert.equal(overlaps(aStart, aEnd, '2026-09-20T12:00:00Z', '2026-09-20T13:00:00Z'), false, 'later, disjoint, should be false');
});

test('overlaps: back-to-back slots are NOT overlapping (half-open interval semantics)', () => {
  // A 10:00-11:00 booking and an 11:00-12:00 booking must be bookable
  // side by side -- the same semantics finding #5's DB-level guard needs.
  assert.equal(overlaps('2026-09-20T10:00:00Z', '2026-09-20T11:00:00Z', '2026-09-20T11:00:00Z', '2026-09-20T12:00:00Z'), false);
});

test('isSlotFree: true with no overlapping range, false when one overlaps', () => {
  const existing = [{ startAt: new Date('2026-09-20T10:00:00Z'), endAt: new Date('2026-09-20T11:00:00Z') }];
  assert.equal(isSlotFree(new Date('2026-09-20T11:00:00Z'), new Date('2026-09-20T12:00:00Z'), existing), true);
  assert.equal(isSlotFree(new Date('2026-09-20T10:30:00Z'), new Date('2026-09-20T11:30:00Z'), existing), false);
});

test('computeMonthAvailability: a confirmed booking closes exactly its own slot label, nothing else', () => {
  // Regression test for docs/AUDIT.md finding #1 -- before the timezone
  // fix, this booking's real UTC instant landed on the WRONG slot labels
  // in the grid (spilling into 10:00/11:00 instead of closing 14:00).
  const confirmedBookings = [{ startAt: new Date('2026-09-20T10:30:00.000Z'), endAt: new Date('2026-09-20T11:30:00.000Z') }]; // = 14:00-15:00 Tehran
  const days = computeMonthAvailability({ jy: 1405, jm: 6, confirmedBookings, blockedSlots: [], now: new Date('2026-09-18T00:00:00Z') });
  const day29 = days.find((d) => d.jalaaliDay === 29);
  for (const slot of day29.slots) {
    const expectedOpen = slot.time !== '14:00';
    assert.equal(slot.open, expectedOpen, `slot ${slot.time} on day 29 should be ${expectedOpen ? 'open' : 'closed'}`);
  }
});

test('computeMonthAvailability: minimum lead time closes near-term slots regardless of bookings', () => {
  const now = new Date('2026-09-20T05:00:00.000Z'); // ~08:30 Tehran on day 29
  const days = computeMonthAvailability({ jy: 1405, jm: 6, confirmedBookings: [], blockedSlots: [], now });
  const day29 = days.find((d) => d.jalaaliDay === 29);
  const slot10 = day29.slots.find((s) => s.time === '10:00'); // 06:30Z, well under 12h from "now"
  assert.equal(slot10.open, false);
});

test('computeMonthAvailability: blocked slots close availability the same way confirmed bookings do', () => {
  const blockedSlots = [{ startAt: new Date('2026-09-20T06:30:00.000Z'), endAt: new Date('2026-09-20T07:30:00.000Z') }]; // = 10:00-11:00 Tehran
  const days = computeMonthAvailability({ jy: 1405, jm: 6, confirmedBookings: [], blockedSlots, now: new Date('2026-09-18T00:00:00Z') });
  const day29 = days.find((d) => d.jalaaliDay === 29);
  assert.equal(day29.slots.find((s) => s.time === '10:00').open, false);
  assert.equal(day29.slots.find((s) => s.time === '11:00').open, true);
});

test('computeRangeAvailability: agrees with computeMonthAvailability for the same real slot', () => {
  const confirmedBookings = [{ startAt: new Date('2026-09-20T10:30:00.000Z'), endAt: new Date('2026-09-20T11:30:00.000Z') }];
  const now = new Date('2026-09-18T00:00:00Z');
  const range = computeRangeAvailability({ days: 5, confirmedBookings, blockedSlots: [], now });
  const day = range.find((d) => {
    const j = toJalaali(d.date.getUTCFullYear(), d.date.getUTCMonth() + 1, d.date.getUTCDate());
    return j.jy === 1405 && j.jm === 6 && j.jd === 29;
  });
  assert.ok(day, 'expected Jalali 1405/6/29 to appear in the 5-day rolling range');
  const closed = day.slots.filter((s) => !s.open).map((s) => s.time);
  assert.deepEqual(closed, ['14:00']);
});
