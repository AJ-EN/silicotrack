import { CampView } from '@/components/camp/CampView';
import { FieldHeader } from '@/components/field/header';
import { LocaleProvider } from '@/components/field/locale';
import { CAMP_ELIGIBLE_WHERE } from '@/lib/camp/eligibility';
import { planCamp, type CampCandidate } from '@/lib/camp/planner';
import { prisma } from '@/lib/db/client';
import type { Tier } from '@/lib/risk/types';

/**
 * /camp — District TB Officer view.
 *
 * Given a district, a block and a capacity of N, produce the N workers who
 * should be screened, clustered by village to minimise travel, and show what
 * targeting buys over inviting the same number at random.
 *
 * Reads live from the database rather than recomputing tiers: the stored
 * assessment is what the field device and the sync route agreed on, and the
 * camp list must show the same number the worker was told.
 */

const DISTRICTS = ['Karauli', 'Jodhpur', 'Dausa', 'Bhilwara'] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clampCapacity(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return 40;
  // A handheld unit and one radiographer do not screen 5,000 people in a day.
  return Math.min(200, Math.max(1, parsed));
}

export default async function CampPage({
  searchParams,
}: PageProps<'/camp'>) {
  const params = await searchParams;

  const requested = first(params.district);
  const district =
    requested !== undefined && (DISTRICTS as readonly string[]).includes(requested)
      ? requested
      : DISTRICTS[0];

  const block = first(params.block) ?? null;
  const capacity = clampCapacity(first(params.capacity));
  const clustered = first(params.clustered) !== '0';

  // Blocks that actually have registered workers, so the filter never offers a
  // choice that yields an empty list.
  const blockRows = await prisma.worker.findMany({
    where: { district },
    select: { block: true },
    distinct: ['block'],
    orderBy: { block: 'asc' },
  });
  const blocks = blockRows.map((row) => row.block);

  const workers = await prisma.worker.findMany({
    where: {
      district,
      ...(block === null ? {} : { block }),
      // Certified workers are not candidates. Filtered in SQL as well as in the
      // planner: the planner's check is the guarantee, this one keeps the query
      // from dragging rows across the wire only to discard them.
      ...CAMP_ELIGIBLE_WHERE,
    },
    select: {
      workerId: true,
      name: true,
      village: true,
      age: true,
      clinicalStatus: true,
      assessments: {
        where: { isCurrent: true },
        select: {
          tier: true,
          cumulativeExposure: true,
          insufficientData: true,
        },
        take: 1,
      },
    },
  });

  const candidates: CampCandidate[] = workers.map((worker) => {
    const assessment = worker.assessments[0];
    return {
      workerId: worker.workerId,
      name: worker.name,
      village: worker.village,
      age: worker.age,
      clinicalStatus: worker.clinicalStatus,
      // A worker with no assessment yet is unknown risk, not low risk — the
      // planner ranks them last but never drops them.
      tier: (assessment?.tier ?? 1) as Tier,
      cumulativeExposure: assessment?.cumulativeExposure ?? 0,
      insufficientData: assessment?.insufficientData ?? true,
    };
  });

  const plan = planCamp(candidates, capacity, { clustered });

  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <CampView
          plan={plan}
          districts={DISTRICTS}
          blocks={blocks}
          district={district}
          block={block}
          capacity={capacity}
          clustered={clustered}
        />
      </main>
    </LocaleProvider>
  );
}
