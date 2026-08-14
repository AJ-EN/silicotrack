import { JemAdminView, type CohortMember } from '@/components/admin/JemAdminView';
import { FieldHeader } from '@/components/field/header';
import { LocaleProvider } from '@/components/field/locale';
import { prisma } from '@/lib/db/client';
import type { SmokingStatus } from '@/lib/risk/types';

/**
 * /admin/jem — coefficient review (CLAUDE.md §7).
 *
 * Ships the cohort's SCORING INPUTS, not its stored assessments: the whole
 * point is to recompute tiers under proposed coefficients, which needs the
 * exposure ledger rather than the answers already derived from it. That is
 * ~180KB for 500 workers and 707 segments, which gzips small and buys instant
 * feedback on every keystroke.
 *
 * There is no auth. The demo has none anywhere (CLAUDE.md §10), and this screen
 * writes nothing — but a real deployment must put this behind a role, because
 * a coefficient is a clinical parameter even when it is only being explored.
 */
export const dynamic = 'force-dynamic';

/** Frozen, matching the seed and the golden file. */
const REFERENCE_DATE = '2026-08-13';

export default async function JemAdminPage() {
  const workers = await prisma.worker.findMany({
    select: {
      workerId: true,
      smokingStatus: true,
      priorTB: true,
      segments: {
        select: {
          taskCode: true,
          method: true,
          enclosure: true,
          ppeUse: true,
          siteType: true,
          startYear: true,
          endYear: true,
          monthsPerYear: true,
          hoursPerDay: true,
        },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const cohort: CohortMember[] = workers.map((worker) => ({
    workerId: worker.workerId,
    smokingStatus: worker.smokingStatus as SmokingStatus,
    priorTB: worker.priorTB,
    segments: worker.segments.map((segment) => ({
      taskCode: segment.taskCode,
      method: segment.method as 'wet' | 'dry',
      enclosure: segment.enclosure as 'open' | 'enclosed',
      ppeUse: segment.ppeUse as 'none' | 'intermittent' | 'consistent',
      siteType: segment.siteType as 'surface' | 'underground',
      startYear: segment.startYear,
      endYear: segment.endYear,
      monthsPerYear: segment.monthsPerYear,
      hoursPerDay: segment.hoursPerDay,
    })),
  }));

  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <JemAdminView cohort={cohort} referenceDate={REFERENCE_DATE} />
      </main>
    </LocaleProvider>
  );
}
