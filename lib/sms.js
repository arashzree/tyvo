/**
 * Single choke point for all outbound SMS — every call site in the app goes
 * through sendSms() below. Swapping providers later means editing only this
 * file; nothing outside it should ever talk to Kavenegar (or whatever
 * replaces it) directly.
 *
 * Currently backed by Kavenegar's Verify Lookup API, which sends
 * pre-approved templates with numbered tokens, not arbitrary free text
 * (brief §6 — templates must go through Kavenegar's panel for approval).
 * That's why sendSms() takes a `purpose` + ordered `tokens` instead of a
 * plain message string: there is no free-text send path on this provider.
 * A provider that does support plain text can drop the purpose/template
 * mapping below without any caller needing to change.
 *
 * KAVENEGAR_TEMPLATE_CONFIRMED / KAVENEGAR_TEMPLATE_REJECTED are the
 * *approved template names* from Kavenegar's panel (set once approval is
 * done — see brief §6, this is a manual step outside of code).
 *
 * Token mapping (fill in exactly what each approved template expects —
 * adjust order/count once the real template text is approved):
 *   confirmed: token=space name (fa), token2=Jalali date+time, token3=reference code
 *   rejected:  token=reference code (kept minimal/neutral per brief §6)
 */

const API_KEY = process.env.KAVENEGAR_API_KEY;
const TEMPLATES = {
  confirmed: process.env.KAVENEGAR_TEMPLATE_CONFIRMED,
  rejected: process.env.KAVENEGAR_TEMPLATE_REJECTED,
};

/** The one function every call site uses. `tokens` fills the purpose's approved template placeholders, in order. */
async function sendSms(phone, { purpose, tokens = [] } = {}) {
  if (!API_KEY) throw new Error('KAVENEGAR_API_KEY is not set');
  const template = TEMPLATES[purpose];
  if (!template) throw new Error(`No approved SMS template configured for purpose "${purpose}"`);

  const params = new URLSearchParams({ receptor: phone, template });
  if (tokens[0]) params.set('token', tokens[0]);
  if (tokens[1]) params.set('token2', tokens[1]);
  if (tokens[2]) params.set('token3', tokens[2]);

  const url = `https://api.kavenegar.com/v1/${API_KEY}/verify/lookup.json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || (data.return && data.return.status !== 200)) {
    throw new Error(`SMS send failed: ${JSON.stringify(data.return || data)}`);
  }
  return data;
}

/** §6.A — sent when admin taps Confirm. */
async function sendConfirmedSms({ phone, spaceNameFa, jalaaliDateTime, referenceCode }) {
  return sendSms(phone, { purpose: 'confirmed', tokens: [spaceNameFa, jalaaliDateTime, referenceCode] });
}

/** §6.B — sent when admin taps Reject. Neutral/polite, no reason given. */
async function sendRejectedSms({ phone, referenceCode }) {
  return sendSms(phone, { purpose: 'rejected', tokens: [referenceCode] });
}

module.exports = { sendSms, sendConfirmedSms, sendRejectedSms };
