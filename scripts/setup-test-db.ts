/**
 * Create the isolated test schema and apply migrations to it.
 *
 *     npm run db:test:setup
 *
 * WHY TESTS NEED THEIR OWN SCHEMA.
 *
 * The ingest tests truncate every table between cases, because verifying
 * "three deliveries leave one row" requires knowing the table started empty.
 * Pointed at the development database, `npm test` silently destroys the seeded
 * cohort — which is what happened once here, and is the sort of thing you only
 * notice when a dashboard reads 1 worker instead of 500.
 *
 * WHY A SCHEMA AND NOT A SEPARATE DATABASE.
 *
 * `prisma dev` ignores the database name in the connection string entirely —
 * every connection lands on `template1` however the URL is written, so
 * CREATE DATABASE buys no isolation at all. Postgres schemas do work, and are
 * honoured through Prisma's `?schema=` parameter, so that is the mechanism.
 * Against a normal Postgres this is equally valid; it just is not the only
 * option there.
 */

import { execSync } from 'node:child_process';

import 'dotenv/config';
import { Client } from 'pg';

const TEST_SCHEMA = 'silicotrack_test';

export function testUrlFrom(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('schema', TEST_SCHEMA);
  return url.toString();
}

async function main(): Promise<void> {
  const baseUrl = process.env['DATABASE_URL'];
  if (baseUrl === undefined || baseUrl === '') {
    throw new Error('DATABASE_URL is not set. Run `npx prisma dev --detach` first.');
  }

  const client = new Client({ connectionString: baseUrl });
  await client.connect();
  // Identifier cannot be parameterised; the name is a local constant.
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.end();
  console.log(`Schema "${TEST_SCHEMA}" ready`);

  const testUrl = testUrlFrom(baseUrl);

  // `migrate deploy`, not `migrate dev`: this schema is disposable and should
  // only ever receive migrations that are already committed.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  console.log('\nAdd this line to your .env:\n');
  console.log(`TEST_DATABASE_URL="${testUrl}"`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
