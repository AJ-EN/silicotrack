import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '@/generated/prisma/client';
import { ingestSubmission } from '../ingest';
import type { FieldSubmission } from '@/lib/validation/field';

/**
 * Runs against a REAL Postgres — `prisma dev` locally, or whatever
 * DATABASE_URL points at in CI.
 *
 * These used to run on an in-memory SQLite built from the committed migration.
 * That stopped being honest the moment the project moved to Postgres: the bug
 * these tests exist to catch is a primary-key collision on replay, and
 * verifying primary-key behaviour against a different engine from the one that
 * will actually enforce it proves very little.
 *
 * The other 206 tests are pure and need no database. Only this file does, so
 * only this file skips when there isn't one.
 */

/**
 * TEST_DATABASE_URL, never DATABASE_URL, and never the `public` schema.
 *
 * `reset()` below truncates every table. Pointed at the development data that
 * destroys the seeded cohort — which happened twice while building this, and
 * is only noticed when a dashboard reads 1 worker instead of 500.
 *
 * Isolation needs BOTH halves, because Prisma routes ORM queries and raw SQL
 * differently under a driver adapter:
 *
 *   * ORM queries ignore `?schema=` in the connection string entirely and go
 *     to `public`. They are routed by the adapter's `{ schema }` option.
 *   * Raw SQL follows the connection's search_path, which the URL parameter
 *     does set — but it is qualified explicitly below rather than trusted.
 *
 * Getting only one of those right is worse than getting neither: the ORM
 * writes into the development schema while TRUNCATE clears an empty one, so
 * tests both corrupt real data and leak state into each other.
 *
 * `npm run db:test:setup` creates the schema and prints the value.
 */
const connectionString = process.env['TEST_DATABASE_URL'];
const hasDatabase = connectionString !== undefined && connectionString !== '';

const schema = hasDatabase
  ? (new URL(connectionString).searchParams.get('schema') ?? 'public')
  : 'public';

if (hasDatabase && schema === 'public') {
  throw new Error(
    'TEST_DATABASE_URL must name a dedicated schema — these tests truncate every ' +
      'table, and "public" holds development data. Run `npm run db:test:setup`.',
  );
}

const prisma = hasDatabase
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString }, { schema }),
    })
  : null;

/** Tables in dependency order; CASCADE handles the rest. */
const TABLES = [
  'ReferralStageEvent',
  'Referral',
  'ScreeningEvent',
  'CampInvite',
  'Camp',
  'RiskAssessment',
  'ExposureSegment',
  'Worker',
];

/**
 * Truncate rather than drop-and-recreate: the schema is owned by the migration
 * and applied once, so tests should not be authoring DDL. Every table name is
 * schema-qualified so this can never reach `public` even if search_path drifts.
 */
async function reset(): Promise<void> {
  if (prisma === null) return;
  const qualified = TABLES.map((table) => `"${schema}"."${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
}

/** The demo narrative worker: twelve years of dry drilling, asymptomatic. */
function submission(overrides: Partial<FieldSubmission> = {}): FieldSubmission {
  return {
    workerId: 'W-test-0001',
    worker: {
      name: 'Test Worker',
      age: 44,
      sex: 'male',
      district: 'Karauli',
      block: 'Todabhim',
      village: 'Bharkholi',
      phone: null,
      smokingStatus: 'never',
      priorTB: false,
    },
    segments: [
      {
        taskCode: 'DRILL_DRY',
        material: 'sandstone',
        method: 'dry',
        enclosure: 'open',
        ppeUse: 'none',
        siteType: 'surface',
        startYear: 2015,
        endYear: null,
        monthsPerYear: 12,
        hoursPerDay: 8,
        durationCertainty: 'approximate',
        frequencyPattern: 'seasonal_migrant',
        siteName: null,
      },
    ],
    capturedAt: '2026-08-13T09:15:00Z',
    referenceDate: '2026-08-13',
    createdBy: 'ASHA-DEMO',
    ...overrides,
  };
}

// `describe.skipIf` keeps the suite green on a machine with no database while
// making the skip visible in the reporter, rather than silently passing.
const describeDb = describe.skipIf(!hasDatabase);

if (!hasDatabase) {
  console.warn(
    '[ingest.test] TEST_DATABASE_URL unset — skipping database tests. ' +
      'Run `npx prisma dev --detach` then `npm run db:test:setup`.',
  );
}

beforeEach(reset);
afterAll(async () => {
  if (prisma !== null) await prisma.$disconnect();
});

describeDb('first delivery', () => {
  it('stores the worker, the ledger, and a recomputed assessment', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());

    expect(await prisma.worker.count()).toBe(1);
    expect(await prisma.exposureSegment.count()).toBe(1);
    expect(await prisma.exposureSegment.findFirst()).toMatchObject({
      durationCertainty: 'approximate',
      frequencyPattern: 'seasonal_migrant',
    });

    const assessment = await prisma.riskAssessment.findFirst({
      where: { isCurrent: true },
    });
    // Matches golden profile P03 exactly — the server recomputes rather than
    // trusting the tier the device sent, and must agree with it.
    expect(assessment?.cumulativeExposure).toBe(3.36);
    expect(assessment?.baseTier).toBe(3);
    expect(assessment?.tier).toBe(3);
    expect(assessment?.rescreenMonths).toBe(24);
    expect(assessment?.confidence).toBe('provisional');
    expect(assessment?.reasonEn).toContain('12 years of dry drilling');
  });
});

describeDb('replay is idempotent — REGRESSION', () => {
  /**
   * A device on a 2G link re-delivers batches it already delivered. That is
   * the normal case.
   *
   * This previously failed: the assessment id is deterministic on
   * (workerId, capturedAt), so `create` violated the primary key, rolled the
   * transaction back, and the route reported "persist failed" to the device.
   * The outbox then retried forever and its pending badge never cleared —
   * while the data was already safely stored.
   */
  it('leaves the database identical after three deliveries', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());
    await ingestSubmission(prisma, submission());
    await ingestSubmission(prisma, submission());

    expect(await prisma.worker.count()).toBe(1);
    expect(await prisma.exposureSegment.count()).toBe(1);
    expect(await prisma.riskAssessment.count()).toBe(1);
    expect(await prisma.riskAssessment.count({ where: { isCurrent: true } })).toBe(1);
  });

  it('does not throw on replay', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());
    await expect(ingestSubmission(prisma, submission())).resolves.toBeUndefined();
  });
});

describeDb('a genuine re-interview supersedes rather than overwrites', () => {
  it('keeps history and moves isCurrent to the newest capture', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());
    await ingestSubmission(
      prisma,
      submission({
        capturedAt: '2026-08-14T10:00:00Z',
        referenceDate: '2026-08-14',
        worker: {
          ...submission().worker,
          smokingStatus: 'current',
          priorTB: true,
        },
      }),
    );

    const all = await prisma.riskAssessment.findMany({
      orderBy: { computedAt: 'asc' },
    });
    expect(all).toHaveLength(2);
    expect(all[0]?.isCurrent).toBe(false);
    expect(all[1]?.isCurrent).toBe(true);
    // Prior TB and current smoking both fire, so the tier rises 3 → 4 while
    // the exposure figure is unchanged.
    expect(all[1]?.baseTier).toBe(3);
    expect(all[1]?.tier).toBe(4);
  });

  it('never lets a field re-sync reset clinical status', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());

    // The board certifies this worker, out of band from the field app.
    await prisma.worker.update({
      where: { workerId: 'W-test-0001' },
      data: { clinicalStatus: 'CERTIFIED' },
    });

    // The ASHA worker re-interviews them and syncs again. An ASHA worker does
    // not certify anyone and must not be able to un-certify anyone either —
    // which is why the sync payload has no clinicalStatus field at all.
    await ingestSubmission(prisma, submission({ capturedAt: '2026-08-14T10:00:00Z' }));

    const worker = await prisma.worker.findUnique({
      where: { workerId: 'W-test-0001' },
    });
    expect(worker?.clinicalStatus).toBe('CERTIFIED');
  });

  it('defaults a newly registered worker to UNKNOWN', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());
    const worker = await prisma.worker.findUnique({
      where: { workerId: 'W-test-0001' },
    });
    expect(worker?.clinicalStatus).toBe('UNKNOWN');
  });

  it('preserves who registered the worker and when', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission());
    await ingestSubmission(
      prisma,
      submission({
        capturedAt: '2026-08-14T10:00:00Z',
        createdBy: 'ASHA-SOMEONE-ELSE',
      }),
    );

    const worker = await prisma.worker.findUnique({
      where: { workerId: 'W-test-0001' },
    });
    expect(worker?.createdBy).toBe('ASHA-DEMO');
    expect(worker?.createdAt).toBe('2026-08-13T09:15:00Z');
  });
});

describeDb('the ledger is replaced wholesale', () => {
  it('leaves no orphaned segments when a later capture has fewer', async () => {
    if (prisma === null) return;
    await ingestSubmission(
      prisma,
      submission({
        segments: [
          ...submission().segments,
          {
            taskCode: 'LOAD',
            material: 'sandstone',
            method: 'dry',
            enclosure: 'open',
            ppeUse: 'none',
            siteType: 'surface',
            startYear: 2005,
            endYear: 2014,
            monthsPerYear: 12,
            hoursPerDay: 8,
            siteName: null,
          },
        ],
      }),
    );
    expect(await prisma.exposureSegment.count()).toBe(2);

    // The interviewer corrected the record: the loading job was never held.
    await ingestSubmission(prisma, submission({ capturedAt: '2026-08-15T08:00:00Z' }));
    expect(await prisma.exposureSegment.count()).toBe(1);
  });
});

describeDb('an incomplete interview is stored as such', () => {
  it('flags insufficientData rather than recording a low-risk worker', async () => {
    if (prisma === null) return;
    await ingestSubmission(prisma, submission({ segments: [] }));

    const assessment = await prisma.riskAssessment.findFirst({
      where: { isCurrent: true },
    });
    expect(assessment?.insufficientData).toBe(true);
    expect(assessment?.tier).toBe(1);
    expect(assessment?.reasonEn).toContain('Interview incomplete');
  });
});
