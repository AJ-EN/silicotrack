/**
 * Camp planning — who gets the seats.
 *
 * Pure functions. No I/O, no clock, no database. The caller supplies the
 * candidate pool; this decides the list.
 *
 * The problem is a real constraint, not a UI feature. One handheld X-ray unit,
 * one radiographer, one day, capacity N. The district has thousands of exposed
 * workers. Choosing which N is the entire lever this project has, because test
 * accuracy is fixed (CXR ~48% sensitive) and cannot be improved by software.
 *
 * Two objectives pull against each other:
 *
 *   RISK      — invite the highest-exposure workers.
 *   TRAVEL    — a team that visits six villages in a day screens fewer people
 *               than one that visits two. Scattered lists lose seats to a jeep.
 *
 * The planner resolves this by selecting whole villages in priority order
 * rather than skimming the top N individuals across the block, and reports what
 * that choice cost in risk terms so the trade is visible rather than hidden.
 */

import type { Tier } from '@/lib/risk/types';

import { isCampEligible } from './eligibility';

/** The tier at and above which a worker is considered a priority invitee. */
export const HIGH_TIER_THRESHOLD: Tier = 3;

/**
 * Most stops a team will make in one day. `[CAL]` — a travel budget, not an
 * epidemiological value. Overridable per camp.
 */
export const DEFAULT_MAX_VILLAGES = 3;

/**
 * How many seats an extra village must win before it justifies the drive.
 *
 * A tenth of capacity, floored at two. `[CAL]` — there is no literature on
 * what a jeep costs in screening seats. Expressed as a share of capacity so it
 * scales sensibly: on a 20-seat camp two workers matter, on a 200-seat camp
 * they do not.
 */
export function minGain(capacity: number): number {
  return Math.max(2, Math.ceil(capacity * 0.1));
}

export interface CampCandidate {
  workerId: string;
  name: string;
  village: string;
  age: number;
  tier: Tier;
  cumulativeExposure: number;
  clinicalStatus: string;
  /** True when the interview was never completed. Ranked last, never dropped. */
  insufficientData: boolean;
}

export interface SelectedCandidate extends CampCandidate {
  /** 1-based position on the call list. */
  rank: number;
}

export interface VillageCluster {
  village: string;
  /** Workers from this village on the final list. */
  selected: number;
  /** Eligible workers in this village overall. */
  eligible: number;
  highTier: number;
}

export interface CampPlan {
  selected: SelectedCandidate[];
  villages: VillageCluster[];
  capacity: number;
  /** Candidates eligible after the clinical-status filter. */
  eligibleCount: number;
  /** Candidates removed by the clinical-status filter. */
  excludedCount: number;
  enrichment: Enrichment;
}

/**
 * How much more exposed the invited list is than the pool it was drawn from.
 *
 * DELIBERATELY NOT EXPRESSED AS CASES FOUND. The brief calls this "projected
 * yield", and it is tempting to multiply a tier by a dose-response curve and
 * print an expected number of silicosis cases. That would be a probability of
 * disease, which this system is not permitted to output (CLAUDE.md §2.1), and
 * it would apply a cohort-level curve to named individuals, which
 * RISK_MODEL.md §1 explicitly disclaims as invalid inference.
 *
 * What is reported instead is a statement about EXPOSURE, which is measured
 * (however provisionally) rather than inferred: this list carries N times the
 * cumulative silica exposure of a same-sized list drawn at random from the same
 * block. That is the honest form of the argument, and it is still the argument
 * — targeting works because prevalence rises with exposure.
 */
export interface Enrichment {
  selectedMeanExposure: number;
  /** Mean across the whole eligible pool — what random invitation would give. */
  poolMeanExposure: number;
  /** selectedMean / poolMean. 1.0 means the list is no better than random. */
  exposureRatio: number;
  selectedHighTierShare: number;
  poolHighTierShare: number;
  /** Villages a team must visit to deliver this list. */
  villagesToVisit: number;
}

/**
 * Ranking within a village, and the fallback ranking overall.
 *
 * Tier first, then raw cumulative exposure to break ties inside a tier, then
 * workerId so the list is byte-stable across runs — a call list that reshuffles
 * between page loads is not a call list.
 *
 * Incomplete interviews sort LAST but are never removed. They are not low risk;
 * they are unknown risk, and the right response is to finish the interview, not
 * to drop the person from the queue.
 */
export function compareCandidates(a: CampCandidate, b: CampCandidate): number {
  if (a.insufficientData !== b.insufficientData) return a.insufficientData ? 1 : -1;
  if (b.tier !== a.tier) return b.tier - a.tier;
  if (b.cumulativeExposure !== a.cumulativeExposure) {
    return b.cumulativeExposure - a.cumulativeExposure;
  }
  return a.workerId.localeCompare(b.workerId);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Build a prioritised, village-clustered call list.
 *
 * `clustered: false` returns a pure top-N by risk, ignoring travel. The camp
 * screen renders both so the DTO can see exactly what clustering costs.
 */
export function planCamp(
  candidates: readonly CampCandidate[],
  capacity: number,
  options: { clustered?: boolean; maxVillages?: number } = {},
): CampPlan {
  const clustered = options.clustered ?? true;
  const maxVillages = Math.max(1, options.maxVillages ?? DEFAULT_MAX_VILLAGES);

  const eligible = candidates.filter((candidate) => isCampEligible(candidate.clinicalStatus));
  const excludedCount = candidates.length - eligible.length;
  const seats = Math.max(0, Math.floor(capacity));

  const ranked = [...eligible].sort(compareCandidates);

  let chosen: CampCandidate[];

  if (!clustered) {
    chosen = ranked.slice(0, seats);
  } else {
    // Group by village, each group internally ranked.
    const byVillage = new Map<string, CampCandidate[]>();
    for (const candidate of ranked) {
      const group = byVillage.get(candidate.village) ?? [];
      group.push(candidate);
      byVillage.set(candidate.village, group);
    }

    /**
     * Village priority: how many high-tier workers it holds, then its total
     * cumulative exposure, then name for stability.
     *
     * Count rather than mean, deliberately. A hamlet with one tier-4 worker
     * has a perfect mean and is still a bad use of a day's travel; a village
     * with twelve tier-3 workers fills most of a camp in one stop.
     */
    const villagesByPriority = [...byVillage.entries()].sort(([nameA, a], [nameB, b]) => {
      const highA = a.filter((c) => c.tier >= HIGH_TIER_THRESHOLD).length;
      const highB = b.filter((c) => c.tier >= HIGH_TIER_THRESHOLD).length;
      if (highB !== highA) return highB - highA;

      const exposureA = a.reduce((sum, c) => sum + c.cumulativeExposure, 0);
      const exposureB = b.reduce((sum, c) => sum + c.cumulativeExposure, 0);
      if (exposureB !== exposureA) return exposureB - exposureA;

      return nameA.localeCompare(nameB);
    });

    /**
     * Villages are added in priority order until the camp can be filled. Then
     * one more may be added, and another, but only while each is WORTH THE
     * DRIVE — and never beyond `maxVillages`.
     *
     * The stopping rule is the interesting part. Two failure modes bracket it:
     *
     *   Stop too early, and a tier-1 worker in the first village takes a seat
     *   from a tier-4 worker in the next one. That is bad targeting bought for
     *   a small travel saving, and targeting is the only lever this project
     *   has.
     *
     *   Stop too late, and the team drives to a hamlet to collect one extra
     *   worker, losing more seats to the road than it gains.
     *
     * So an additional village is taken only if it supplies at least
     * `minGain` candidates that would displace someone already on the list.
     * "Worth a stop" is quantified rather than assumed.
     */
    const reachable: CampCandidate[] = [];

    for (const [, group] of villagesByPriority) {
      const visited = new Set(reachable.map((c) => c.village)).size;

      if (reachable.length >= seats) {
        if (visited >= maxVillages) break;

        // Would this village actually change the list? Compare against the
        // current cutoff — the worst worker who currently holds a seat.
        const provisional = [...reachable].sort(compareCandidates).slice(0, seats);
        const cutoff = provisional[provisional.length - 1];
        if (cutoff === undefined) break;

        const gain = group.filter(
          (candidate) => compareCandidates(candidate, cutoff) < 0,
        ).length;
        if (gain < minGain(seats)) break;
      }

      reachable.push(...group);
    }

    chosen = reachable.sort(compareCandidates).slice(0, seats);
  }

  // The printed list is risk-ordered regardless of how it was assembled: the
  // health worker calling names should work down by priority, not by village.
  const selected: SelectedCandidate[] = [...chosen]
    .sort(compareCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const selectedVillages = new Set(selected.map((candidate) => candidate.village));

  const villages: VillageCluster[] = [...selectedVillages]
    .map((village) => ({
      village,
      selected: selected.filter((c) => c.village === village).length,
      eligible: eligible.filter((c) => c.village === village).length,
      highTier: selected.filter(
        (c) => c.village === village && c.tier >= HIGH_TIER_THRESHOLD,
      ).length,
    }))
    .sort((a, b) => b.selected - a.selected || a.village.localeCompare(b.village));

  const selectedMean = mean(selected.map((c) => c.cumulativeExposure));
  const poolMean = mean(eligible.map((c) => c.cumulativeExposure));

  const highShare = (group: readonly CampCandidate[]): number =>
    group.length === 0
      ? 0
      : (group.filter((c) => c.tier >= HIGH_TIER_THRESHOLD).length / group.length) * 100;

  return {
    selected,
    villages,
    capacity: seats,
    eligibleCount: eligible.length,
    excludedCount,
    enrichment: {
      selectedMeanExposure: round2(selectedMean),
      poolMeanExposure: round2(poolMean),
      // Guarded: a pool of entirely unexposed workers would divide by zero.
      exposureRatio: poolMean === 0 ? 0 : round2(selectedMean / poolMean),
      selectedHighTierShare: round2(highShare(selected)),
      poolHighTierShare: round2(highShare(eligible)),
      villagesToVisit: selectedVillages.size,
    },
  };
}
