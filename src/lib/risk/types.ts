/**
 * Shared types for the risk engine.
 *
 * The engine is deliberately decoupled from persistence. The types here
 * describe only what is needed to *compute* a score. Prisma entities are
 * structural supersets — a `Worker` row satisfies `WorkerRiskFacts`, an
 * `ExposureSegment` row satisfies `ExposureSegmentInput` — so no mapping layer
 * is required, and the engine can be tested with plain object literals.
 */

import type { JemTaskCode } from './jem';

export type Tier = 1 | 2 | 3 | 4;

export type SmokingStatus = 'never' | 'former' | 'current';

export type WorkMethod = 'wet' | 'dry';

export type EnclosureType = 'open' | 'enclosed';

export type PpeUse = 'none' | 'intermittent' | 'consistent';

export type SiteType = 'surface' | 'underground';

/**
 * One entry in a worker's exposure ledger.
 *
 * `taskCode` is typed as `string` rather than `JemTaskCode` because segments
 * arrive from the database and the offline sync outbox, where the value is
 * whatever was stored. `engine.ts` resolves it through `resolveTaskCode()`,
 * which falls back to `OTHER` rather than throwing — a worker with an
 * unrecognised task must still be scored, since dropping them removes them
 * from the screening queue entirely.
 */
export interface ExposureSegmentInput {
  taskCode: string;
  method: WorkMethod;
  enclosure: EnclosureType;
  ppeUse: PpeUse;
  siteType: SiteType;
  startYear: number;
  /** `null` means ongoing — resolved to the reference year, never to "now". */
  endYear: number | null;
  monthsPerYear: number;
  hoursPerDay: number;
}

/** The only worker attributes that affect the score. Deliberately minimal. */
export interface WorkerRiskFacts {
  smokingStatus: SmokingStatus;
  priorTB: boolean;
}

/**
 * PEAK_INTENSITY was removed at v1 — it fired for zero of 500 workers because
 * its threshold sat above the JEM ceiling. See RISK_MODEL.md §7.2.
 */
export type EscalationCode = 'PRIOR_TB' | 'LATENCY' | 'CURRENT_SMOKER';

export interface EscalationReason {
  code: EscalationCode;
  /**
   * False when the rule fired but was dropped by the escalation step cap.
   * Retained rather than filtered out so the UI can show a health worker
   * everything that was considered, not just what counted.
   */
  applied: boolean;
}

export interface TaskContribution {
  taskCode: JemTaskCode;
  /** mg/m³·years contributed by all segments of this task, 2dp. */
  contribution: number;
  /** Share of total cumulative exposure, 1dp. */
  percentOfTotal: number;
  /**
   * Full-time-equivalent years on this task, 1dp. This is the `duration_years`
   * term the model actually multiplies, so it carries the hours-per-day and
   * months-per-year scaling: a decade of 12-hour days is 15 FTE years.
   *
   * NEVER render this as "N years" to a user. It is not wall-clock time and
   * routinely exceeds it — a 45-year career at 12 hours a day is 67.5 FTE
   * years, which reads as an obvious error to anyone holding the worker's file.
   */
  fteYears: number;
  /**
   * Distinct calendar years in which this task was worked. This is what a
   * person means by "12 years of dry drilling", and the only one of the two
   * that belongs in a human-readable string.
   *
   * Neither field is in the brief's output contract. Both are here because the
   * reason string needs one and the model needs the other, and conflating them
   * is precisely the bug this pair exists to prevent.
   */
  calendarYears: number;
}

export interface RiskResult {
  /** mg/m³·years, 2dp. */
  cumulativeExposure: number;
  /**
   * mg/m³, 2dp. Highest single-segment intensity after control modifiers.
   *
   * REPORTED BUT NOT ACTED ON. No escalation reads this at v1; it is here so a
   * reviewer can see a worker's worst exposure concentration, and because peak
   * is good evidence of risk independent of cumulative dose (Buchanan et al.
   * 2003). Reinstating it as a rule needs a sourced JEM, not a lower threshold.
   */
  peakIntensity: number;
  yearsSinceFirstExposure: number;
  /**
   * Years since the worker's most recent exposure ended. Zero while still
   * exposed.
   *
   * Reported alongside TSFE because the two answer different questions, and
   * the LATENCY rule arguably wants this clock rather than TSFE — see the
   * open question in RISK_MODEL.md §7.2.
   */
  yearsSinceLastExposure: number;
  /** True when no recorded segment runs into the reference year. */
  exposureEnded: boolean;
  /** Tier from cumulative exposure alone, before escalation. */
  baseTier: Tier;
  /** Final tier, after escalation. Never lower than `baseTier`. */
  tier: Tier;
  escalations: EscalationReason[];
  rescreenMonths: number;
  topContributors: TaskContribution[];
  reasonEn: string;
  reasonHi: string;
  modelVersion: string;
  jemVersion: string;
  confidence: 'provisional';
  /**
   * True when the worker has no exposure segments at all.
   *
   * Not in the brief's output contract. Added because without it a worker whose
   * interview was never completed is indistinguishable from a genuinely
   * low-exposure worker who was — both land at `CE = 0`, Tier 1. Incomplete
   * interviews would then hide inside the low-risk bucket, which is precisely
   * the failure mode this system exists to fix.
   *
   * The UI must render these as "Interview incomplete", not as Tier 1.
   */
  insufficientData: boolean;
}

export interface RiskEngineInput {
  segments: readonly ExposureSegmentInput[];
  worker: WorkerRiskFacts;
  /**
   * ISO date string, e.g. `'2026-08-13'`.
   *
   * Passed in, never read from the clock. `TSFE` depends on it directly, so an
   * engine that called `Date.now()` would produce output that changes between
   * a test run and the same test run tomorrow.
   */
  referenceDate: string;
}
