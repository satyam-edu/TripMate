import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱  Starting seed...');

  // ── 1. Clean existing data (in FK-safe order) ─────────────────────────────
  await prisma.request.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️   Cleared existing records.');

  // ── 2. Create the seed host user ──────────────────────────────────────────
  const host = await prisma.user.create({
    data: {
      googleId: 'seed-host-priya-001',
      name: 'Priya K.',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
      bio: 'Solo traveller | 12 countries | Chai over coffee ☕',
      gender: 'Female',
      tags: ['Backpacker', 'Nature', 'Photography'],
    },
  });
  console.log(`👤  Created host: ${host.name} (${host.id})`);

  // ── 3. Create trips ───────────────────────────────────────────────────────
  const trips = await prisma.trip.createManyAndReturn({
    data: [
      // ── Trip 1: Coorg ──────────────────────────────────────────────────
      {
        hostId: host.id,
        destination: 'Coorg Coffee Estate',
        country: 'Karnataka, India',
        startDate: new Date('2026-05-10T00:00:00.000Z'),
        endDate:   new Date('2026-05-15T00:00:00.000Z'),
        budget:    18000,
        maxGuests: 6,
        tags:      ['Nature', 'Wellness'],
      },
      // ── Trip 2: Udaipur ────────────────────────────────────────────────
      {
        hostId: host.id,
        destination: 'Udaipur Royal Heritage',
        country: 'Rajasthan, India',
        startDate: new Date('2026-10-20T00:00:00.000Z'),
        endDate:   new Date('2026-10-25T00:00:00.000Z'),
        budget:    45000,
        maxGuests: 4,
        tags:      ['Luxury', 'Photography'],
      },
      // ── Trip 3: Spiti ──────────────────────────────────────────────────
      {
        hostId: host.id,
        destination: 'Spiti Valley Expedition',
        country: 'Himachal Pradesh, India',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate:   new Date('2026-06-10T00:00:00.000Z'),
        budget:    35000,
        maxGuests: 8,
        tags:      ['Adventure', 'Road Trip'],
      },
    ],
  });

  trips.forEach((t) => console.log(`✈️   Created trip: "${t.destination}" (${t.id})`));

  console.log('\n✅  Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
