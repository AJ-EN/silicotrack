import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '@/generated/prisma/client';
import { ingestSubmission } from '../ingest';
import type { FieldSubmission } from '@/lib/validation/field';

/**
 * Runs against an in-memory SQLite database built from the committed
 * migration, so the test exercises the real schema — including the primary key
 * that caused the bug this file exists to prevent — without touching dev.db.
 */
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: ':memory:' }) });

function migrationSql(): string {
  const dir = fileURLToPath(new URL('../../../../prisma/migrations', import.meta.url));
  return readdirSync(dir)
    .filter((entry) => entry !== 'migration_lock.toml')
    .sort()
    .map((entry) => readFileSync(`${dir}/${entry}/migration.sql`, 'utf8'))
    .join('\n');
}

async function resetSchema(): Promise<void> {
  const tables = [
    'ReferralStageEvent',
    'Referral',
    'ScreeningEvent',
    'CampInvite',
    'Camp',
    'RiskAssessment',
    'ExposureSegment',
    'Worker',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);
  }
  for (const statement of migrationSql().split(';')) {
    if (statement.trim() !== '') await prisma.$executeRawUnsafe(statement);
  }
}

beforeEach(resetSchema);
afterAll(async () => prisma.$disconnect());

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
        siteName: null,
      },
    ],
    capturedAt: '2026-08-13T09:15:00Z',
    referenceDate: '2026-08-13',
    createdBy: 'ASHA-DEMO',
    ...overrides,
  };
}

describe('first delivery', () => {
  it('stores the worker, the ledger, and a recomputed assessment', async () => {
    await ingestSubmission(prisma, submission());

    expect(await prisma.worker.count()).toBe(1);
    expect(await prisma.exposureSegment.count()).toBe(1);

    const assessment = await prisma.riskAssessment.findFirst({ where: { isCurrent: true } });
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

describe('replay is idempotent — REGRESSION', () => {
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
    await ingestSubmission(prisma, submission());
    await ingestSubmission(prisma, submission());
    await ingestSubmission(prisma, submission());

    expect(await prisma.worker.count()).toBe(1);
    expect(await prisma.exposureSegment.count()).toBe(1);
    expect(await prisma.riskAssessment.count()).toBe(1);
    expect(await prisma.riskAssessment.count({ where: { isCurrent: true } })).toBe(1);
  });

  it('does not throw on replay', async () => {
    await ingestSubmission(prisma, submission());
    await expect(ingestSubmission(prisma, submission())).resolves.toBeUndefined();
  });
});

describe('a genuine re-interview supersedes rather than overwrites', () => {
  it('keeps history and moves isCurrent to the newest capture', async () => {
    await ingestSubmission(prisma, submission());
    await ingestSubmission(
      prisma,
      submission({
        capturedAt: '2026-08-14T10:00:00Z',
        referenceDate: '2026-08-14',
        worker: { ...submission().worker, smokingStatus: 'current', priorTB: true },
      }),
    );

    const all = await prisma.riskAssessment.findMany({ orderBy: { computedAt: 'asc' } });
    expect(all).toHaveLength(2);
    expect(all[0]?.isCurrent).toBe(false);
    expect(all[1]?.isCurrent).toBe(true);
    // Prior TB and current smoking both fire, so the tier rises 3 → 4 while
    // the exposure figure is unchanged.
    expect(all[1]?.baseTier).toBe(3);
    expect(all[1]?.tier).toBe(4);
  });

  it('preserves who registered the worker and when', async () => {
    await ingestSubmission(prisma, submission());
    await ingestSubmission(
      prisma,
      submission({ capturedAt: '2026-08-14T10:00:00Z', createdBy: 'ASHA-SOMEONE-ELSE' }),
    );

    const worker = await prisma.worker.findUnique({ where: { workerId: 'W-test-0001' } });
    expect(worker?.createdBy).toBe('ASHA-DEMO');
    expect(worker?.createdAt).toBe('2026-08-13T09:15:00Z');
  });
});

describe('the ledger is replaced wholesale', () => {
  it('leaves no orphaned segments when a later capture has fewer', async () => {
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

describe('an incomplete interview is stored as such', () => {
  it('flags insufficientData rather than recording a low-risk worker', async () => {
    await ingestSubmission(prisma, submission({ segments: [] }));

    const assessment = await prisma.riskAssessment.findFirst({ where: { isCurrent: true } });
    expect(assessment?.insufficientData).toBe(true);
    expect(assessment?.tier).toBe(1);
    expect(assessment?.reasonEn).toContain('Interview incomplete');
  });
});
