const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids confusion when read aloud/SMS'd

function generateReferenceCode() {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return `TYVO-${code}`;
}

/** Generates a code and retries on the rare unique-constraint collision. */
async function generateUniqueReferenceCode(prisma, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferenceCode();
    const existing = await prisma.booking.findUnique({ where: { referenceCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique reference code after several attempts');
}

module.exports = { generateReferenceCode, generateUniqueReferenceCode };
