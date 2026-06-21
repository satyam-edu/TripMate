import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const ava = (id: string) => `https://images.unsplash.com/photo-${id}?w=200&h=200&fit=crop&auto=format`;
const cover = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop&auto=format`;

async function main(): Promise<void> {
  console.log('🌱  Starting seed...');

  // ── 1. Clean existing data (in FK-safe order) ─────────────────────────────
  await prisma.request.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany({ where: { googleId: { startsWith: 'seed-' } } });
  console.log('🗑️   Cleared seed records.');

  // ── 2. Create seed users (hosts + travelers) ──────────────────────────────
  const seedUsers = [
    { googleId: 'seed-priya', name: 'Priya Nair', gender: 'Female', avatar: ava('1534528741775-53994a69daeb'), bio: 'Solo traveller | 12 countries | Chai over coffee ☕', tags: ['Sightseeing', 'Photography'] },
    { googleId: 'seed-rohan', name: 'Rohan Mehta', gender: 'Male', avatar: ava('1507003211169-0a1dd7228f2d'), bio: 'Mountains > everything. Always chasing altitude.', tags: ['Trekking', 'Photography'] },
    { googleId: 'seed-ananya', name: 'Ananya Iyer', gender: 'Female', avatar: ava('1494790108377-be9c29b29330'), bio: 'Beach bum and café hopper 🌊', tags: ['Beach Time', 'Food & Cafés'] },
    { googleId: 'seed-kabir', name: 'Kabir Singh', gender: 'Male', avatar: ava('1506794778202-cad84cf45f1d'), bio: 'Adrenaline junkie. Rafting, bungee, repeat.', tags: ['Trekking'] },
    { googleId: 'seed-meera', name: 'Meera Kapoor', gender: 'Female', avatar: ava('1544005313-94ddf0286df2'), bio: 'Slow travel + good food + great company.', tags: ['Relaxation', 'Food & Cafés'] },
  ];

  const users = await Promise.all(seedUsers.map((u) => prisma.user.create({ data: u })));
  const priya = users[0]!;
  const rohan = users[1]!;
  const ananya = users[2]!;
  const kabir = users[3]!;
  const meera = users[4]!;
  console.log(`👤  Created ${users.length} seed users.`);

  // ── 3. Create trips (future dates so they appear in the feed; category-led tags) ──
  const trips = await prisma.trip.createManyAndReturn({
    data: [
      {
        hostId: rohan.id,
        destination: 'Spiti Valley Expedition',
        country: 'Himachal Pradesh',
        startDate: new Date('2026-07-12T00:00:00.000Z'),
        endDate: new Date('2026-07-19T00:00:00.000Z'),
        budget: 18500,
        maxGuests: 6,
        tags: ['Mountains', 'Trekking', 'Photography'],
        coverImage: cover('1626621341517-bbf3d9990a23'),
        description: 'High-altitude desert, monasteries, and the bluest skies in India.',
      },
      {
        hostId: ananya.id,
        destination: 'Goa Coastline',
        country: 'North Goa',
        startDate: new Date('2026-08-03T00:00:00.000Z'),
        endDate: new Date('2026-08-07T00:00:00.000Z'),
        budget: 12000,
        maxGuests: 6,
        tags: ['Beaches', 'Relaxation', 'Nightlife'],
        coverImage: cover('1512343879784-a960bf40e7f2'),
        description: 'Sunsets at Anjuna, beach shacks, and slow mornings.',
      },
      {
        hostId: priya.id,
        destination: 'Udaipur Royal Heritage',
        country: 'Rajasthan',
        startDate: new Date('2026-10-20T00:00:00.000Z'),
        endDate: new Date('2026-10-25T00:00:00.000Z'),
        budget: 21000,
        maxGuests: 4,
        tags: ['Culture', 'Sightseeing', 'Photography'],
        coverImage: cover('1599661046289-e31897846e41'),
        description: 'City of Lakes — palaces, boat rides, and golden-hour photo walks.',
      },
      {
        hostId: kabir.id,
        destination: 'Rishikesh Rapids',
        country: 'Uttarakhand',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-09-04T00:00:00.000Z'),
        budget: 8200,
        maxGuests: 8,
        tags: ['Adventure', 'Trekking'],
        coverImage: cover('1544735716-392fe2489ffa'),
        description: 'White-water rafting, cliff jumps, and riverside camping.',
      },
      {
        hostId: meera.id,
        destination: 'Kerala Backwaters',
        country: 'Alleppey',
        startDate: new Date('2026-09-05T00:00:00.000Z'),
        endDate: new Date('2026-09-11T00:00:00.000Z'),
        budget: 19000,
        maxGuests: 4,
        tags: ['Wildlife', 'Relaxation', 'Food & Cafés'],
        coverImage: cover('1602216056096-3b40cc0c9944'),
        description: 'Houseboats, lush greenery, and the calmest waters around.',
      },
      {
        hostId: rohan.id,
        destination: 'Manali & Kasol',
        country: 'Himachal Pradesh',
        startDate: new Date('2026-08-20T00:00:00.000Z'),
        endDate: new Date('2026-08-26T00:00:00.000Z'),
        budget: 15800,
        maxGuests: 6,
        tags: ['Road Trip', 'Trekking', 'Relaxation'],
        coverImage: cover('1593181629936-11c609b8db9b'),
        description: 'A classic Himachal road trip through pine forests and river valleys.',
      },
    ],
  });
  trips.forEach((t) => console.log(`✈️   Trip: "${t.destination}" [${t.tags[0]}]`));

  // ── 4. A few pending requests between seed users (realistic data) ─────────
  const spiti = trips[0]!;
  const goa = trips[1]!;
  const rishikesh = trips[3]!;
  await prisma.request.createMany({
    data: [
      { tripId: spiti.id, userId: priya.id, status: 'PENDING', message: 'Would love to join the Spiti run!' },
      { tripId: spiti.id, userId: ananya.id, status: 'APPROVED' },
      { tripId: goa.id, userId: kabir.id, status: 'PENDING' },
      { tripId: rishikesh.id, userId: meera.id, status: 'APPROVED' },
    ],
  });
  console.log('📨  Created sample requests.');

  console.log('\n✅  Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
