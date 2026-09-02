/**
 * Server-side re-validation — mirrors the frontend's checks (prototype's
 * booking-flow controller) so the server never trusts client-side-only
 * validation. Per brief §4 ("Server-side re-validates: ... phone format").
 */

const faArDigits = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function normalizeDigits(s) {
  return String(s || '').replace(/[۰-۹٠-٩]/g, (d) => (faArDigits[d] !== undefined ? faArDigits[d] : d));
}

function isValidIranPhone(v) {
  return /^09\d{9}$/.test(normalizeDigits(v).trim());
}

function isValidEmail(v) {
  if (!v) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

/** MINIMUM_LEAD_HOURS: brief §2 — "Minimum booking lead time: 12 hours from now." */
const MINIMUM_LEAD_HOURS = 12;

function isWithinMinimumLeadTime(startAt, now = new Date()) {
  const diffMs = new Date(startAt).getTime() - now.getTime();
  return diffMs < MINIMUM_LEAD_HOURS * 60 * 60 * 1000;
}

module.exports = {
  normalizeDigits,
  isValidIranPhone,
  isValidEmail,
  MINIMUM_LEAD_HOURS,
  isWithinMinimumLeadTime,
};
