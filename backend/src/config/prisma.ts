import { PrismaClient } from '@prisma/client';

// Singleton pattern: reuses a single PrismaClient instance during development
// to prevent connection pool exhaustion from hot-reloads.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
