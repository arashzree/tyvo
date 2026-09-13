/**
 * Best-effort abuse protection for POST /api/bookings (docs/AUDIT.md
 * finding #6) — the endpoint is public and unauthenticated, and every
 * successful submission pages every owner/rental_manager on Telegram, so a
 * naive flood script is both a cost problem and a way to spam real humans.
 *
 * Two independent layers, since neither alone is airtight in a serverless
 * environment:
 *  - IP-based, in-memory: catches a single script hammering the endpoint,
 *    for free, with no DB round-trip — works even if the DB itself is down.
 *    Only as strong as the warm-container lifetime: a determined attacker
 *    spread across many cold-started Lambda containers can evade it.
 *    Deliberately not backed by a new DB table/column this pass — schema
 *    changes are being sequenced carefully while there's no staging DB
 *    (docs/AUDIT.md finding #12).
 *  - Phone-based, DB-backed: survives cold starts and multiple containers,
 *    using the customer_phone column that already exists — no migration
 *    needed. Catches the same phone number submitting repeatedly even if
 *    spread across many IPs/containers.
 */

const IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const IP_MAX_REQUESTS = 5;

const ipHits = new Map(); // ip -> array of recent request timestamps (ms), pruned lazily on each check

function getClientIp(event) {
  const headers = event.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers['x-nf-client-connection-ip'] || headers['client-ip'] || null;
}

/**
 * Records this request and returns true if the IP has made too many recent
 * requests. Counts every attempt (not just successes), so retried failures
 * still count against the limit. Returns false (does not block) if the
 * caller's IP can't be determined — the phone-based check below is the
 * fallback layer in that case, rather than blocking blindly.
 */
function isIpRateLimited(event, now = Date.now()) {
  const ip = getClientIp(event);
  if (!ip) return false;

  const hits = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  ipHits.set(ip, hits);

  return hits.length > IP_MAX_REQUESTS;
}

const PHONE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PHONE_MAX_BOOKINGS = 3;

/**
 * True if this phone number has submitted too many bookings recently.
 * DB-backed (survives cold starts and multiple containers), counting all
 * recent submissions regardless of status — a rejected/spam request still
 * counts, since it already made noise on Telegram.
 */
async function isPhoneRateLimited(prisma, phone, now = new Date()) {
  const windowStart = new Date(now.getTime() - PHONE_WINDOW_MS);
  const recentCount = await prisma.booking.count({
    where: { customerPhone: phone, createdAt: { gte: windowStart } },
  });
  return recentCount >= PHONE_MAX_BOOKINGS;
}

module.exports = {
  isIpRateLimited,
  isPhoneRateLimited,
  getClientIp,
  IP_WINDOW_MS,
  IP_MAX_REQUESTS,
  PHONE_WINDOW_MS,
  PHONE_MAX_BOOKINGS,
};
