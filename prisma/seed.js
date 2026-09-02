/**
 * Seeds the `spaces` table from the exact `rooms` array in the approved
 * frontend prototype (tyvo-rental-full-flow.html), including the nameFa
 * localization added in the cross-platform fix pass. Run with:
 *   npx prisma db seed
 * (wire this up in package.json: "prisma": { "seed": "node prisma/seed.js" })
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Kept in the exact order/content as the prototype's `rooms` array so
// sort_order matches what users see in the existing menu.
const rooms = [
  { name: 'White Box A', nameFa: 'باکس سفید A', slug: 'white-box-a', featured: true, tag: 'Largest',
    description: 'Our biggest studio — spacious enough for full productions and group shoots.' },
  { name: 'White Box B', nameFa: 'باکس سفید B', slug: 'white-box-b', featured: false, tag: null,
    description: 'Balanced light and space for product and portrait work.' },
  { name: 'White Box C', nameFa: 'باکس سفید C', slug: 'white-box-c', featured: false, tag: null,
    description: 'Compact and efficient — ideal for quick shoots and content batches.' },
  { name: 'Red Rock', nameFa: 'رد راک', slug: 'red-rock', featured: false, tag: null,
    description: 'A bold, textured red-rock backdrop for editorial and fashion shoots.' },
  { name: 'Podcast Room', nameFa: 'اتاق پادکست', slug: 'podcast-room', featured: false, tag: null,
    description: 'Acoustically treated space built for podcast and audio recording.' },
  { name: 'Cafe', nameFa: 'کافه', slug: 'cafe', featured: false, tag: null,
    description: 'A relaxed cafe-styled setting for lifestyle content and casual meetings.' },
  { name: 'Conference Room', nameFa: 'اتاق کنفرانس', slug: 'conference-room', featured: false, tag: null,
    description: 'A professional space for meetings, panels and presentations.' },
];

async function main() {
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    await prisma.space.upsert({
      where: { slug: r.slug },
      update: { ...r, sortOrder: i, active: true },
      create: { ...r, sortOrder: i, active: true },
    });
  }
  console.log(`Seeded ${rooms.length} spaces.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
