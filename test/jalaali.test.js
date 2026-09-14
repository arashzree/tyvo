const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toJalaali,
  toGregorian,
  isLeapJalaaliYear,
  jalaaliMonthLength,
  dateFromJalaali,
  dateFromJalaaliDateTime,
  instantToTehranParts,
  IRAN_OFFSET_MINUTES,
  parseJalaaliMonthParam,
} = require('../lib/jalaali');

test('toJalaali / toGregorian round-trip across a wide date range', () => {
  const start = Date.UTC(2010, 0, 1);
  const end = Date.UTC(2040, 0, 1);
  for (let t = start; t < end; t += 37 * 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    const gy = d.getUTCFullYear();
    const gm = d.getUTCMonth() + 1;
    const gd = d.getUTCDate();
    const j = toJalaali(gy, gm, gd);
    const back = toGregorian(j.jy, j.jm, j.jd);
    assert.equal(back.gy, gy, `year mismatch at ${d.toISOString()}`);
    assert.equal(back.gm, gm, `month mismatch at ${d.toISOString()}`);
    assert.equal(back.gd, gd, `day mismatch at ${d.toISOString()}`);
  }
});

test('known reference date: 2024-03-20 (Nowruz) is Jalali 1403/01/01', () => {
  assert.deepEqual(toJalaali(2024, 3, 20), { jy: 1403, jm: 1, jd: 1 });
});

test('jalaaliMonthLength: months 1-6 have 31 days, 7-11 have 30, month 12 depends on leap year', () => {
  for (let m = 1; m <= 6; m++) assert.equal(jalaaliMonthLength(1403, m), 31);
  for (let m = 7; m <= 11; m++) assert.equal(jalaaliMonthLength(1403, m), 30);
  // 1403 is a known Jalali leap year (30-day Esfand); 1404 is not (29-day Esfand).
  assert.equal(isLeapJalaaliYear(1403), true);
  assert.equal(jalaaliMonthLength(1403, 12), 30);
  assert.equal(isLeapJalaaliYear(1404), false);
  assert.equal(jalaaliMonthLength(1404, 12), 29);
});

test('parseJalaaliMonthParam: valid input', () => {
  assert.deepEqual(parseJalaaliMonthParam('1405-06'), { jy: 1405, jm: 6 });
});

test('parseJalaaliMonthParam: rejects malformed input', () => {
  assert.throws(() => parseJalaaliMonthParam('not-a-month'));
  assert.throws(() => parseJalaaliMonthParam('1405-13'));
  assert.throws(() => parseJalaaliMonthParam(''));
});

test('dateFromJalaaliDateTime <-> instantToTehranParts round-trip (the check that would have caught the timezone bug, docs/AUDIT.md finding #1)', () => {
  for (let i = 0; i < 500; i++) {
    const gy = 2024 + Math.floor(i / 60);
    const gm = 1 + (i % 12);
    const gd = 1 + (i % 28);
    const hour = 10 + (i % 11); // business hours, matches TIME_SLOTS
    const j = toJalaali(gy, gm, gd);
    const instant = dateFromJalaaliDateTime(j.jy, j.jm, j.jd, hour, 0);
    const back = instantToTehranParts(instant);
    const backJalaali = toJalaali(back.year, back.month, back.day);
    assert.deepEqual(backJalaali, j, `date round-trip failed for ${j.jy}/${j.jm}/${j.jd} ${hour}:00`);
    assert.equal(back.hours, hour, `hour round-trip failed for ${j.jy}/${j.jm}/${j.jd} ${hour}:00`);
    assert.equal(back.minutes, 0);
  }
});

test('dateFromJalaaliDateTime applies the Asia/Tehran offset, not a literal UTC stamp', () => {
  // Regression case for docs/AUDIT.md finding #1: a customer picking 14:00
  // Tehran must NOT produce an instant of literal 14:00 UTC -- it must be
  // offset by IRAN_OFFSET_MINUTES (210 = 3.5h). This is the exact bug that
  // made the availability grid and every admin-facing display wrong.
  const j = toJalaali(2026, 9, 20);
  const instant = dateFromJalaaliDateTime(j.jy, j.jm, j.jd, 14, 0);
  const naiveUtcStamp = Date.UTC(2026, 8, 20, 14, 0);
  assert.equal(naiveUtcStamp - instant.getTime(), IRAN_OFFSET_MINUTES * 60 * 1000);
});

test('dateFromJalaali (day-only) round-trips to Tehran midnight, one calendar day apart from the next', () => {
  const day1 = dateFromJalaali(1405, 6, 29);
  const day2 = dateFromJalaali(1405, 6, 30);
  assert.equal(day2.getTime() - day1.getTime(), 24 * 60 * 60 * 1000);
});
