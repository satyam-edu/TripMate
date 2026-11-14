import { PrismaClient } from '@prisma/client';

// Singleton pattern: reuses a single PrismaClient instance during development
// to prevent connection pool exhaustion from hot-reloads.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only errors and warnings by default. To see every SQL query while debugging,
    // start the backend with PRISMA_LOG_QUERIES=true (e.g. PRISMA_LOG_QUERIES=true npm run dev).
    log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
