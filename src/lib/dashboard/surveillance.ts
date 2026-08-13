/**
 * District surveillance metrics.
 *
 * Pure functions. No I/O, no clock.
 *
 * The one genuinely novel figure here is the SYMPTOM-GATE IMPACT: how many
 * workers with radiological findings the current criterion discards for having
 * no symptoms. Everything else on the dashboard is bookkeeping.
 */

import { isCertifiedOutcome } from '@/lib/referral/stages';
import type { Tier } from '@/lib/risk/types';

export interface SurveillanceWorker {
  workerId: string;
  district: string;
  /** Null when the worker has no assessment at all. */
  tier: Tier | null;
  insufficientData: boolean;
}

export interface SurveillanceInvite {
  workerId: string;
  attended: boolean;
}

export interface SurveillanceScreening {
  workerId: string;
  outcome: string;
  /** ILO profusion category as read by a radiologist, e.g. "0/1", "1/1". */
  radiologistRead: string | null;
}

export interface SurveillanceReferral {
  workerId: string;
  status: string;
}

/**
 * Is this ILO reading positive for pneumoconiosis?
 *
 * The ILO scale is written `major/minor` — the category the reader settled on,
 * over the one they also seriously considered. The MAJOR category is the
 * decision; `1/0` means "category 1, but I considered 0" and is positive,
 * while `0/1` means "category 0, but I considered 1" and is not.
 *
 * Threshold is major ≥ 1, matching the definition used by six of the eight
 * cohorts in Howlett et al. (Thorax 2024).
 *
 * NOTE — this is a radiographic threshold, not a disease threshold. Hoy et al.
 * (Respirology 2024) found 18% of workers read as ILO category 0 had silicosis
 * on HRCT. Workers below this line are not thereby healthy, and nothing on the
 * dashboard should be phrased as though they were.
 */
export function isAbnormalIloRead(read: string | null): boolean {
  if (read === null) return false;
  const major = Number.parseInt(read.split('/')[0] ?? '', 10);
  return Number.isFinite(major) && major >= 1;
}

/**
 * Did this film prompt any onward action?
 *
 * Anything other than a clean `0/0` — so category 1+ AND the borderline `0/1`,
 * where the reader considered category 1. Those workers are referred too, and
 * the detection cascade has to count them or it narrows faster on paper than
 * it does in the clinic.
 */
export function isFlaggedRead(read: string | null): boolean {
  if (read === null) return false;
  return read.trim() !== '' && read !== '0/0';
}

export interface CohortCounts {
  registered: number;
  assessed: number;
  /** Registered but the exposure interview was never completed. */
  incomplete: number;
  invited: number;
  attended: number;
  /**
   * Films that were not read as a clean 0/0 — ILO category 1+ PLUS the
   * borderline 0/1 readings.
   *
   * This, not `abnormal`, is the step that feeds referral. A worker read 0/1
   * is below the pneumoconiosis threshold but is still sent onward, so a
   * cascade built on `abnormal` alone shows fewer people entering referral
   * than actually enter it — a funnel that widens, which is either a bug or a
   * lie depending on how charitable the reader is.
   */
  flaggedForReview: number;
  /** Screened with an ILO major category ≥ 1. The symptom-gate denominator. */
  abnormal: number;
  referred: number;
  certified: number;
}

export interface TierRow {
  tier: Tier;
  count: number;
  share: number;
}

export interface DistrictRow {
  district: string;
  workers: number;
  priority: number;
  priorityShare: number;
  attended: number;
  abnormal: number;
  certified: number;
}

/**
 * What the symptom criterion costs.
 *
 * The system never asks a worker about symptoms — early silicosis has none,
 * which is the whole premise. So the asymptomatic determination here is NOT
 * ours: it is the state's own, recorded at CHC as the reason for rejection.
 * This measures their criterion against their own assessment, using their
 * stage vocabulary. That is what makes it arguable rather than rhetorical.
 */
export interface SymptomGateImpact {
  /** Workers with an ILO major category ≥ 1 reading. */
  abnormalFindings: number;
  /** Of those, how many the CHC rejected for having no symptoms. */
  discardedAtSymptomGate: number;
  /** Share of abnormal findings discarded, 1dp. */
  discardRate: number;
  /** Of those discarded, how many were already exposure tier 3 or 4. */
  discardedAtHighTier: number;
  /**
   * The state's published figure, for comparison: 11,288 of 21,871
   * applications rejected at CHC level for absent symptoms.
   */
  statePublishedRejectionRate: number;
}

export interface Surveillance {
  cohort: CohortCounts;
  tiers: TierRow[];
  districts: DistrictRow[];
  symptomGate: SymptomGateImpact;
}

export const STATE_PUBLISHED_REJECTION_RATE = 57.6;

function share(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export interface SurveillanceInput {
  workers: readonly SurveillanceWorker[];
  invites: readonly SurveillanceInvite[];
  screenings: readonly SurveillanceScreening[];
  referrals: readonly SurveillanceReferral[];
}

export function buildSurveillance(input: SurveillanceInput): Surveillance {
  const { workers, invites, screenings, referrals } = input;

  const registered = workers.length;
  const incomplete = workers.filter((worker) => worker.insufficientData).length;
  const assessed = workers.filter(
    (worker) => worker.tier !== null && !worker.insufficientData,
  ).length;

  // A worker invited to several camps is one invited worker, not three.
  const invitedIds = new Set(invites.map((invite) => invite.workerId));
  const attendedIds = new Set(
    invites.filter((invite) => invite.attended).map((invite) => invite.workerId),
  );

  const abnormalIds = new Set(
    screenings
      .filter((screening) => isAbnormalIloRead(screening.radiologistRead))
      .map((screening) => screening.workerId),
  );

  const flaggedIds = new Set(
    screenings
      .filter((screening) => isFlaggedRead(screening.radiologistRead))
      .map((screening) => screening.workerId),
  );

  const referredIds = new Set(referrals.map((referral) => referral.workerId));
  const certifiedIds = new Set(
    referrals
      .filter((referral) => isCertifiedOutcome(referral.status))
      .map((referral) => referral.workerId),
  );

  const cohort: CohortCounts = {
    registered,
    assessed,
    incomplete,
    invited: invitedIds.size,
    attended: attendedIds.size,
    flaggedForReview: flaggedIds.size,
    abnormal: abnormalIds.size,
    referred: referredIds.size,
    certified: certifiedIds.size,
  };

  const tierOf = new Map(workers.map((worker) => [worker.workerId, worker.tier]));

  const tiers: TierRow[] = ([1, 2, 3, 4] as Tier[]).map((tier) => {
    const count = workers.filter((worker) => worker.tier === tier).length;
    return { tier, count, share: share(count, registered) };
  });

  const districtNames = [...new Set(workers.map((worker) => worker.district))].sort();

  const districts: DistrictRow[] = districtNames.map((district) => {
    const inDistrict = workers.filter((worker) => worker.district === district);
    const ids = new Set(inDistrict.map((worker) => worker.workerId));
    const priority = inDistrict.filter((worker) => worker.tier === 4).length;

    return {
      district,
      workers: inDistrict.length,
      priority,
      priorityShare: share(priority, inDistrict.length),
      attended: [...attendedIds].filter((id) => ids.has(id)).length,
      abnormal: [...abnormalIds].filter((id) => ids.has(id)).length,
      certified: [...certifiedIds].filter((id) => ids.has(id)).length,
    };
  });

  // --- The symptom gate ---
  const discardedIds = new Set(
    referrals
      .filter((referral) => referral.status === 'REJECTED_NO_SYMPTOMS')
      .map((referral) => referral.workerId),
  );

  const discardedWithFindings = [...abnormalIds].filter((id) => discardedIds.has(id));
  const discardedAtHighTier = discardedWithFindings.filter((id) => {
    const tier = tierOf.get(id);
    return tier === 3 || tier === 4;
  }).length;

  const symptomGate: SymptomGateImpact = {
    abnormalFindings: abnormalIds.size,
    discardedAtSymptomGate: discardedWithFindings.length,
    discardRate: share(discardedWithFindings.length, abnormalIds.size),
    discardedAtHighTier,
    statePublishedRejectionRate: STATE_PUBLISHED_REJECTION_RATE,
  };

  return { cohort, tiers, districts, symptomGate };
}
