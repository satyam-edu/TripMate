import { PrismaClient } from '@prisma/client';

// Singleton pattern: reuses a single PrismaClient instance during development
// to prevent connection pool exhaustion from hot-reloads.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Printing every query is handy locally but slows and floods production logs.
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
