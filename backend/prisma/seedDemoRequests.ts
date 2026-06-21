import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Demo helper for a single-account walkthrough.
 * After you log in (Google) and post a trip, run `npm run seed:demo` to drop a
 * few PENDING join requests from seed users onto your newest trip — so you can
 * click Accept / Decline in the Requests → Received tab.
 */
async function main(): Promise<void> {
  // The "real" user = anyone who didn't come from the seed (real Google sub id).
  const realUser = await prisma.user.findFirst({
    where: { NOT: { googleId: { startsWith: 'seed-' } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!realUser) {
    console.log('⚠️   No Google user found yet. Log in once, then re-run.');
    return;
  }

  const trip = await prisma.trip.findFirst({
    where: { hostId: realUser.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!trip) {
    console.log(`⚠️   ${realUser.name} has no trips yet. Post a trip first, then re-run.`);
    return;
  }

  const seedUsers = await prisma.user.findMany({
    where: { googleId: { startsWith: 'seed-' } },
    take: 3,
  });
  if (seedUsers.length === 0) {
    console.log('⚠️   No seed users found. Run `npm run seed` first.');
    return;
  }

  let created = 0;
  for (const u of seedUsers) {
    try {
      await prisma.request.create({
        data: {
          tripId: trip.id,
          userId: u.id,
          status: 'PENDING',
          message: `Hey ${realUser.name.split(' ')[0]}! I'd love to join ${trip.destination}.`,
        },
      });
      created++;
    } catch {
      // Unique (tripId, userId) conflict — this user already requested. Skip.
    }
  }

  console.log(
    `✅  Added ${created} pending request(s) to "${trip.destination}" for ${realUser.name}.\n` +
      '    Open the app → Requests → Received to Accept / Decline.',
  );
}

main()
  .catch((e) => {
    console.error('❌  seed:demo failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
