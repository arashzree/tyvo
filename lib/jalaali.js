/**
 * Tyvo Media — shared Jalali (Shamsi) <-> Gregorian conversion.
 *
 * IMPORTANT: this is a verbatim port of the exact functions already tested
 * and shipped in the approved frontend prototype (tyvo-rental-full-flow.html,
 * the booking-flow controller script). Do NOT reimplement independently —
 * per Backend Build Brief v1 §2, client and server must use the identical
 * algorithm so the two sides never drift apart on a date.
 *
 * If you ever touch this file, apply the exact same change to the prototype's
 * copy (and vice versa), or better: have the frontend import this file once
 * the project has a shared build step.
 *
 * Standard public-domain astronomical algorithm (Borkowski) — the same math
 * used by the widely-used `jalaali-js` package.
 */

function jDiv(a, b) { return ~~(a / b); }
function jMod(a, b) { return a - ~~(a / b) * b; }

function jalCal(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  let gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, leap, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + jDiv(jump, 33) * 8 + jDiv(jMod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + jDiv(n, 33) * 8 + jDiv(jMod(n, 33) + 3, 4);
  if (jMod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = jDiv(gy, 4) - jDiv((jDiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + jDiv(jump, 33) * 33;
  leap = jMod(jMod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = jDiv((gy + jDiv(gm - 8, 6) + 100100) * 1461, 4) + jDiv(153 * jMod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - jDiv(jDiv(gy + 100100 + jDiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + jDiv(jDiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = jDiv(jMod(j, 1461), 4) * 5 + 308;
  const gd = jDiv(jMod(i, 153), 5) + 1;
  const gm = jMod(jDiv(i, 153), 12) + 1;
  const gy = jDiv(j, 1461) - 100100 + jDiv(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jDiv(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  let gy = d2g(jdn).gy, jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f, jm, jd;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + jDiv(k, 31), jd: jMod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + jDiv(k, 30);
  jd = jMod(k, 30) + 1;
  return { jy, jm, jd };
}

/** Gregorian (calendar values, 1-indexed month) -> Jalali {jy, jm, jd} */
function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }

/** Jalali -> Gregorian (calendar values) {gy, gm, gd} */
function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }

function isLeapJalaaliYear(jy) { return jalCal(jy).leap === 0; }

function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

/**
 * Build a UTC Date for a given Jalali calendar date. Assumes the "civil day"
 * boundary — callers needing exact slot timestamps should combine this with
 * an hour offset (see dateFromJalaaliDateTime below).
 */
function dateFromJalaali(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
}

/** Same as dateFromJalaali but also sets an hour (for hourly slot timestamps, e.g. "14:00"). */
function dateFromJalaaliDateTime(jy, jm, jd, hour, minute) {
  const g = toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, hour, minute || 0));
}

/**
 * Parse a "YYYY-MM" Jalali month query param (e.g. "1405-06") into {jy, jm}.
 * Throws on malformed input — callers should catch and return 400.
 */
function parseJalaaliMonthParam(monthParam) {
  const m = /^(\d{3,4})-(\d{1,2})$/.exec(String(monthParam || '').trim());
  if (!m) throw new Error(`Invalid Jalali month param: "${monthParam}" (expected "YYYY-MM", e.g. "1405-06")`);
  const jy = parseInt(m[1], 10);
  const jm = parseInt(m[2], 10);
  if (jm < 1 || jm > 12) throw new Error(`Invalid Jalali month: ${jm}`);
  return { jy, jm };
}

const shamsiMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

module.exports = {
  toJalaali,
  toGregorian,
  isLeapJalaaliYear,
  jalaaliMonthLength,
  dateFromJalaali,
  dateFromJalaaliDateTime,
  parseJalaaliMonthParam,
  shamsiMonths,
};
