/**
 * Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter — there is no built-in engine
 * connection any more.
 *
 * Postgres everywhere: `prisma dev` locally, a hosted Prisma Postgres in
 * deployment. Running SQLite locally and Postgres in production is the classic
 * way to ship a bug that only appears after deploy, and the whole point of
 * keeping the schema portable was to avoid needing two dialects at all.
 *
 * Nothing else in the application knows which database it is talking to.
 */

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client';

function createClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env, then run `npx prisma dev` ' +
        'for a local Postgres and paste the URL it prints.',
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Next.js dev reloads modules on every edit. Without caching the client on
 * globalThis, each reload opens another pool and eventually exhausts the
 * connection limit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
