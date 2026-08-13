/**
 * Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter — there is no built-in engine
 * connection any more. SQLite is the prototype datastore; the production path
 * is Postgres on the Rajasthan State Data Centre, which means swapping
 * `PrismaBetterSqlite3` for `PrismaPg` here and changing the datasource
 * provider in schema.prisma. Nothing else in the application should need to
 * know which database it is talking to.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../../generated/prisma/client';

function createClient(): PrismaClient {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  }

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

/**
 * Next.js dev reloads modules on every edit. Without caching the client on
 * globalThis, each reload opens another connection and eventually exhausts the
 * handle limit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
