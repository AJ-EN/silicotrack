import { describe, expect, it } from 'vitest';

import { HIGH_TIER_THRESHOLD, compareCandidates, planCamp } from '../planner';
import type { CampCandidate } from '../planner';
import type { Tier } from '@/lib/risk/types';

let serial = 0;

function candidate(overrides: Partial<CampCandidate> = {}): CampCandidate {
  serial += 1;
  return {
    workerId: `W-${String(serial).padStart(4, '0')}`,
    name: 'Synthetic Worker',
    village: 'Bharkholi',
    age: 40,
    tier: 1,
    cumulativeExposure: 0.2,
    clinicalStatus: 'UNKNOWN',
    insufficientData: false,
    ...overrides,
  };
}

/** `count` workers in one village, all at the same tier. */
function villageOf(village: string, count: number, tier: Tier, exposure: number) {
  return Array.from({ length: count }, () =>
    candidate({ village, tier, cumulativeExposure: exposure }),
  );
}

describe('ranking', () => {
  it('orders by tier, then exposure, then id for stability', () => {
    const low = candidate({ tier: 2, cumulativeExposure: 1.5 });
    const high = candidate({ tier: 4, cumulativeExposure: 4.2 });
    const mid = candidate({ tier: 3, cumulativeExposure: 2.1 });

    const sorted = [low, high, mid].sort(compareCandidates);
    expect(sorted.map((c) => c.tier)).toEqual([4, 3, 2]);
  });

  it('breaks ties within a tier by cumulative exposure', () => {
    const lighter = candidate({ tier: 3, cumulativeExposure: 2.1 });
    const heavier = candidate({ tier: 3, cumulativeExposure: 3.9 });
    expect([lighter, heavier].sort(compareCandidates)[0]).toBe(heavier);
  });

  it('is a total order — identical inputs never reshuffle', () => {
    // A call list that changes between page loads is not a call list.
    const pool = [
      candidate({ tier: 3, cumulativeExposure: 2 }),
      candidate({ tier: 3, cumulativeExposure: 2 }),
      candidate({ tier: 3, cumulativeExposure: 2 }),
    ];
    const first = [...pool].sort(compareCandidates).map((c) => c.workerId);
    const second = [...pool].reverse().sort(compareCandidates).map((c) => c.workerId);
    expect(first).toEqual(second);
  });

  it('ranks incomplete interviews last without dropping them', () => {
    // They are not low risk, they are UNKNOWN risk. The fix is to finish the
    // interview, not to remove the person from the queue.
    const unknown = candidate({ tier: 1, insufficientData: true });
    const known = candidate({ tier: 1, cumulativeExposure: 0.1 });
    const plan = planCamp([unknown, known], 10);

    expect(plan.selected).toHaveLength(2);
    expect(plan.selected[1]?.workerId).toBe(unknown.workerId);
  });
});

describe('capacity', () => {
  it('never exceeds the seats available', () => {
    const plan = planCamp(villageOf('A', 50, 4, 5), 12);
    expect(plan.selected).toHaveLength(12);
    expect(plan.capacity).toBe(12);
  });

  it('takes everyone when the pool is smaller than capacity', () => {
    const plan = planCamp(villageOf('A', 5, 3, 2), 40);
    expect(plan.selected).toHaveLength(5);
  });

  it('handles a zero-capacity camp and an empty pool', () => {
    expect(planCamp(villageOf('A', 5, 3, 2), 0).selected).toEqual([]);
    expect(planCamp([], 40).selected).toEqual([]);
    expect(planCamp([], 40).enrichment.exposureRatio).toBe(0);
  });

  it('numbers the printed list from 1 in risk order', () => {
    const plan = planCamp(
      [...villageOf('A', 3, 2, 1), ...villageOf('B', 3, 4, 5)],
      6,
    );
    expect(plan.selected.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.selected[0]?.tier).toBe(4);
  });
});

describe('clinical eligibility', () => {
  it('removes certified workers and counts them', () => {
    const plan = planCamp(
      [
        ...villageOf('A', 3, 4, 5),
        candidate({ tier: 4, cumulativeExposure: 9, clinicalStatus: 'CERTIFIED' }),
      ],
      10,
    );
    expect(plan.selected).toHaveLength(3);
    expect(plan.excludedCount).toBe(1);
    expect(plan.eligibleCount).toBe(3);
    expect(plan.selected.some((c) => c.clinicalStatus === 'CERTIFIED')).toBe(false);
  });

  it('excludes them even when they would otherwise top the list', () => {
    const plan = planCamp(
      [
        candidate({ tier: 4, cumulativeExposure: 20, clinicalStatus: 'CERTIFIED' }),
        candidate({ tier: 1, cumulativeExposure: 0.1 }),
      ],
      1,
    );
    expect(plan.selected[0]?.cumulativeExposure).toBe(0.1);
  });
});

describe('village clustering', () => {
  it('prefers villages holding more high-tier workers', () => {
    // One tier-4 worker in a hamlet has a perfect mean and is still a bad use
    // of a day's travel. Twelve tier-3 workers fill most of a camp in one stop.
    const plan = planCamp(
      [...villageOf('Hamlet', 1, 4, 6), ...villageOf('BigVillage', 12, 3, 3)],
      12,
    );
    expect(plan.enrichment.villagesToVisit).toBe(1);
    expect(plan.villages[0]?.village).toBe('BigVillage');
  });

  it('visits fewer villages than an unclustered list of the same size', () => {
    const pool = [
      ...villageOf('A', 4, 4, 5),
      ...villageOf('B', 4, 4, 5),
      ...villageOf('C', 4, 4, 5),
      ...villageOf('D', 4, 4, 5),
    ];
    const clustered = planCamp(pool, 8, { clustered: true });
    const pure = planCamp(pool, 8, { clustered: false });

    expect(clustered.enrichment.villagesToVisit).toBeLessThanOrEqual(
      pure.enrichment.villagesToVisit,
    );
    expect(clustered.enrichment.villagesToVisit).toBe(2);
  });

  it('fills a partially-used village with its highest-risk workers', () => {
    const plan = planCamp(
      [
        ...villageOf('A', 5, 4, 5),
        candidate({ village: 'A', tier: 1, cumulativeExposure: 0.1 }),
      ],
      5,
    );
    expect(plan.selected.every((c) => c.tier === 4)).toBe(true);
  });

  it('never lets a low-tier worker displace a high-tier one in a village it is already visiting', () => {
    // The team drives to both villages regardless, so seats must go to risk,
    // not to whichever village was ranked first. Filling village-by-village
    // would hand all 20 seats to VillageA including its tier-1 workers.
    const plan = planCamp(
      [
        ...villageOf('VillageA', 15, 3, 2.5),
        ...villageOf('VillageA', 10, 1, 0.1),
        ...villageOf('VillageB', 10, 4, 6),
      ],
      20,
      { clustered: true },
    );

    expect(plan.enrichment.villagesToVisit).toBe(2);
    expect(plan.selected.filter((c) => c.tier === 4)).toHaveLength(10);
    expect(plan.selected.some((c) => c.tier === 1)).toBe(false);
  });

  it('recovers most of the targeting that naive clustering would lose', () => {
    const pool = [
      ...villageOf('Big', 20, 2, 1),
      ...villageOf('Small', 20, 4, 6),
    ];
    const clustered = planCamp(pool, 20, { clustered: true });
    const pure = planCamp(pool, 20, { clustered: false });

    // Same seats, same risk ordering within reach — clustering should cost
    // travel-efficiency decisions, not the top of the list.
    expect(clustered.enrichment.selectedMeanExposure).toBe(
      pure.enrichment.selectedMeanExposure,
    );
  });

  it('reports how much of each village was taken', () => {
    const plan = planCamp(villageOf('A', 10, 3, 2), 4);
    expect(plan.villages[0]).toMatchObject({ village: 'A', selected: 4, eligible: 10 });
  });
});

describe('exposure enrichment — the targeting argument', () => {
  /**
   * The claim the camp screen makes is about EXPOSURE, never about cases
   * found. A projected case count would be a probability of disease, which the
   * system is not permitted to output, and would apply a cohort-level curve to
   * named individuals.
   */
  it('reports the selected list as more exposed than the pool', () => {
    const pool = [
      ...villageOf('High', 10, 4, 5.0),
      ...villageOf('Low', 90, 1, 0.2),
    ];
    const plan = planCamp(pool, 10);

    expect(plan.enrichment.selectedMeanExposure).toBe(5);
    expect(plan.enrichment.poolMeanExposure).toBeCloseTo(0.68, 2);
    expect(plan.enrichment.exposureRatio).toBeGreaterThan(5);
  });

  it('reports a ratio of about 1 when everyone is identical', () => {
    // Targeting cannot help if there is nothing to target. The screen must be
    // able to say so rather than manufacturing a favourable number.
    const plan = planCamp(villageOf('A', 40, 2, 1.5), 10);
    expect(plan.enrichment.exposureRatio).toBeCloseTo(1, 5);
  });

  it('raises the high-tier share above the pool', () => {
    const plan = planCamp(
      [...villageOf('High', 8, 4, 5), ...villageOf('Low', 40, 1, 0.2)],
      8,
    );
    expect(plan.enrichment.selectedHighTierShare).toBe(100);
    expect(plan.enrichment.poolHighTierShare).toBeLessThan(20);
  });

  it('uses the eligible pool, not the raw pool, as the baseline', () => {
    // Certified workers are not a comparator — they are not candidates at all,
    // and leaving them in the denominator would flatter the ratio.
    const withCertified = planCamp(
      [
        ...villageOf('A', 5, 3, 2),
        candidate({ tier: 4, cumulativeExposure: 50, clinicalStatus: 'CERTIFIED' }),
      ],
      5,
    );
    expect(withCertified.enrichment.poolMeanExposure).toBe(2);
  });

  it('counts villages to visit, which is what costs the day', () => {
    const plan = planCamp(
      [...villageOf('A', 3, 3, 2), ...villageOf('B', 3, 3, 2)],
      6,
    );
    expect(plan.enrichment.villagesToVisit).toBe(2);
  });
});

describe('the high-tier threshold', () => {
  it('is tier 3', () => {
    expect(HIGH_TIER_THRESHOLD).toBe(3);
  });
});
