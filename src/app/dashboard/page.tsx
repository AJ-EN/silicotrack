import { DashboardView } from '@/components/dashboard/DashboardView';
import { FieldHeader } from '@/components/field/header';
import { LocaleProvider } from '@/components/field/locale';
import { buildSurveillance } from '@/lib/dashboard/surveillance';
import { prisma } from '@/lib/db/client';
import { buildFunnel, type ReferralRecord } from '@/lib/referral/funnel';
import type { Tier } from '@/lib/risk/types';

/**
 * /dashboard — DSAP / DoIT&C district surveillance.
 *
 * Same reason as /referral: with no search params Next would prerender this as
 * static and freeze every figure at build time.
 */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [workerRows, inviteRows, screeningRows, referralRows, funnelRows] =
    await Promise.all([
      prisma.worker.findMany({
        select: {
          workerId: true,
          district: true,
          assessments: {
            where: { isCurrent: true },
            select: { tier: true, insufficientData: true },
            take: 1,
          },
        },
      }),
      prisma.campInvite.findMany({ select: { workerId: true, attended: true } }),
      prisma.screeningEvent.findMany({
        select: { workerId: true, outcome: true, radiologistRead: true },
      }),
      prisma.referral.findMany({ select: { workerId: true, status: true } }),
      prisma.referral.findMany({
        select: {
          id: true,
          status: true,
          daysInStage: true,
          stageHistory: {
            select: { stage: true, enteredAt: true, daysInPreviousStage: true },
            orderBy: { enteredAt: 'asc' },
          },
        },
      }),
    ]);

  const surveillance = buildSurveillance({
    workers: workerRows.map((row) => {
      const assessment = row.assessments[0];
      return {
        workerId: row.workerId,
        district: row.district,
        // No assessment at all is unknown risk, reported as incomplete rather
        // than silently counted into tier 1.
        tier: (assessment?.tier ?? null) as Tier | null,
        insufficientData: assessment?.insufficientData ?? true,
      };
    }),
    invites: inviteRows,
    screenings: screeningRows,
    referrals: referralRows,
  });

  const funnel = buildFunnel(funnelRows as ReferralRecord[]);

  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <DashboardView surveillance={surveillance} funnel={funnel} />
      </main>
    </LocaleProvider>
  );
}
