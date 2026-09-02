const { toJalaali, shamsiMonths } = require('./jalaali');

const faDigitMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function toFaDigits(v) { return String(v).replace(/[0-9]/g, (d) => faDigitMap[d]); }

function formatJalaaliDateTime(startAt) {
  const d = new Date(startAt);
  const j = toJalaali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${toFaDigits(j.jd)} ${shamsiMonths[j.jm - 1]} ${toFaDigits(j.jy)} \u00b7 ${toFaDigits(hh)}:${toFaDigits(mm)}`;
}

/** New booking request — sent to each admin. Includes the §5.3 conflict warning when hasConflict is true. */
function buildNewBookingMessage({ booking, space, hasConflict }) {
  const lines = [];
  if (hasConflict) {
    lines.push('⚠️ <b>این اسلات یک درخواست دیگر هم دارد — لطفاً قبل از تأیید بررسی کنید.</b>', '');
  }
  lines.push(
    `📩 <b>درخواست رزرو جدید</b>`,
    ``,
    `فضا: <b>${escapeHtml(space.nameFa)}</b>`,
    `نام: ${escapeHtml(booking.customerName)}`,
    `موبایل: <code>${escapeHtml(booking.customerPhone)}</code>`,
    `تاریخ و ساعت: ${formatJalaaliDateTime(booking.startAt)}`,
  );
  if (booking.notes) lines.push(`توضیحات: ${escapeHtml(booking.notes)}`);
  lines.push('', `کد رهگیری: <code>${booking.referenceCode}</code>`);
  return lines.join('\n');
}

function buildConfirmedEditText({ booking, space, adminLabel }) {
  return [
    `✅ <b>تأیید شد</b>`,
    ``,
    `فضا: <b>${escapeHtml(space.nameFa)}</b>`,
    `نام: ${escapeHtml(booking.customerName)}`,
    `موبایل: <code>${escapeHtml(booking.customerPhone)}</code>`,
    `تاریخ و ساعت: ${formatJalaaliDateTime(booking.startAt)}`,
    ``,
    `کد رهگیری: <code>${booking.referenceCode}</code>`,
    `توسط: ${escapeHtml(adminLabel || '—')}`,
  ].join('\n');
}

function buildRejectedEditText({ booking, space, adminLabel }) {
  return [
    `❌ <b>رد شد</b>`,
    ``,
    `فضا: <b>${escapeHtml(space.nameFa)}</b>`,
    `نام: ${escapeHtml(booking.customerName)}`,
    `تاریخ و ساعت: ${formatJalaaliDateTime(booking.startAt)}`,
    ``,
    `کد رهگیری: <code>${booking.referenceCode}</code>`,
    `توسط: ${escapeHtml(adminLabel || '—')}`,
  ].join('\n');
}

/** §5.5 — auto-flag (not auto-reject) other pending bookings for the same now-confirmed slot. */
function buildAutoFlagText({ booking, space }) {
  return [
    `⚠️ <b>این اسلات توسط رزرو دیگری تأیید شد — این درخواست را رد کنید؟</b>`,
    ``,
    `فضا: <b>${escapeHtml(space.nameFa)}</b>`,
    `نام: ${escapeHtml(booking.customerName)}`,
    `موبایل: <code>${escapeHtml(booking.customerPhone)}</code>`,
    `تاریخ و ساعت: ${formatJalaaliDateTime(booking.startAt)}`,
    ``,
    `کد رهگیری: <code>${booking.referenceCode}</code>`,
  ].join('\n');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

module.exports = {
  formatJalaaliDateTime,
  buildNewBookingMessage,
  buildConfirmedEditText,
  buildRejectedEditText,
  buildAutoFlagText,
};
