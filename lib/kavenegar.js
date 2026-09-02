/**
 * Kavenegar SMS — templated messages via the Verify Lookup API (this is
 * the endpoint used for pre-approved "pattern" templates, matching brief
 * §6's requirement that templates go through Kavenegar's panel for
 * approval before they can be used).
 *
 * KAVENEGAR_TEMPLATE_CONFIRMED / KAVENEGAR_TEMPLATE_REJECTED are the
 * *approved template names* from Kavenegar's panel (set once approval is
 * done — see brief §6, this is a manual step outside of code).
 *
 * Token mapping (fill in exactly what each approved template expects —
 * adjust order/count once the real template text is approved):
 *   CONFIRMED: token=space name (fa), token2=Jalali date+time, token3=reference code
 *   REJECTED:  token=reference code (kept minimal/neutral per brief §6)
 */

const API_KEY = process.env.KAVENEGAR_API_KEY;
const TEMPLATE_CONFIRMED = process.env.KAVENEGAR_TEMPLATE_CONFIRMED;
const TEMPLATE_REJECTED = process.env.KAVENEGAR_TEMPLATE_REJECTED;

async function lookupSend({ receptor, template, token, token2, token3 }) {
  if (!API_KEY) throw new Error('KAVENEGAR_API_KEY is not set');
  const params = new URLSearchParams({ receptor, template });
  if (token) params.set('token', token);
  if (token2) params.set('token2', token2);
  if (token3) params.set('token3', token3);

  const url = `https://api.kavenegar.com/v1/${API_KEY}/verify/lookup.json?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || (data.return && data.return.status !== 200)) {
    throw new Error(`Kavenegar send failed: ${JSON.stringify(data.return || data)}`);
  }
  return data;
}

/** §6.A — sent when admin taps Confirm. */
async function sendConfirmedSms({ phone, spaceNameFa, jalaaliDateTime, referenceCode }) {
  if (!TEMPLATE_CONFIRMED) throw new Error('KAVENEGAR_TEMPLATE_CONFIRMED is not set');
  return lookupSend({
    receptor: phone,
    template: TEMPLATE_CONFIRMED,
    token: spaceNameFa,
    token2: jalaaliDateTime,
    token3: referenceCode,
  });
}

/** §6.B — sent when admin taps Reject. Neutral/polite, no reason given. */
async function sendRejectedSms({ phone, referenceCode }) {
  if (!TEMPLATE_REJECTED) throw new Error('KAVENEGAR_TEMPLATE_REJECTED is not set');
  return lookupSend({
    receptor: phone,
    template: TEMPLATE_REJECTED,
    token: referenceCode,
  });
}

module.exports = { sendConfirmedSms, sendRejectedSms };
