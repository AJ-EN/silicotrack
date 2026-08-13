import { FieldHeader } from '@/components/field/header';
import { LocaleProvider } from '@/components/field/locale';
import { ReferralView, type StalledRow } from '@/components/referral/ReferralView';
import { prisma } from '@/lib/db/client';
import { buildFunnel, type ReferralRecord } from '@/lib/referral/funnel';
import { COMPLETE_STAGES, STALLED_DAYS } from '@/lib/referral/stages';
import type { Tier } from '@/lib/risk/types';

/**
 * /referral — DPB coordinator view.
 *
 * Two questions, both of which the state portal has the data to answer and
 * does not: where does the pipeline lose people, and which referrals can still
 * be rescued today.
 */

/**
 * Never prerendered.
 *
 * This page takes no search params, so Next would happily treat it as static
 * and freeze the funnel — and the stalled worklist — at build time. A
 * coordinator would then open it each morning to a snapshot of whenever the
 * app was last deployed. `/camp` escapes this by accident because it reads
 * searchParams; this page has to say so.
 */
export const dynamic = 'force-dynamic';

export default async function ReferralPage() {
  const referrals = await prisma.referral.findMany({
    select: {
      id: true,
      status: true,
      daysInStage: true,
      stageHistory: {
        select: { stage: true, enteredAt: true, daysInPreviousStage: true },
        orderBy: { enteredAt: 'asc' },
      },
    },
  });

  const funnel = buildFunnel(referrals as ReferralRecord[]);

  // Stalled list, filtered in SQL. Completed referrals — rejected, lost, or
  // fully disbursed — are excluded here exactly as `isStalled` excludes them.
  // A coordinator's worklist should contain only what they can still act on.
  const stalledRows = await prisma.referral.findMany({
    where: {
      daysInStage: { gt: STALLED_DAYS },
      status: { notIn: [...COMPLETE_STAGES] },
    },
    select: {
      id: true,
      status: true,
      daysInStage: true,
      toBoard: true,
      worker: {
        select: {
          workerId: true,
          name: true,
          village: true,
          district: true,
          assessments: {
            where: { isCurrent: true },
            select: { tier: true },
            take: 1,
          },
        },
      },
    },
    // Longest wait first: that is the order a coordinator should work in.
    orderBy: { daysInStage: 'desc' },
  });

  const stalled: StalledRow[] = stalledRows.map((row) => ({
    id: row.id,
    workerId: row.worker.workerId,
    name: row.worker.name,
    village: row.worker.village,
    district: row.worker.district,
    status: row.status,
    daysInStage: row.daysInStage,
    toBoard: row.toBoard,
    tier: (row.worker.assessments[0]?.tier ?? null) as Tier | null,
  }));

  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <ReferralView funnel={funnel} stalled={stalled} />
      </main>
    </LocaleProvider>
  );
}
