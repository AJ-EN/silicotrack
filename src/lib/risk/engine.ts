/**
 * Cumulative silica exposure engine.
 *
 *     CE = Σ over segments of ( I_task × M_controls × duration_years )
 *
 * Specification: docs/RISK_MODEL.md. Every threshold in this file is justified
 * there, and every value that is a calibration choice rather than a literature
 * value is marked as such.
 *
 * PURITY CONTRACT — enforced by test, not convention:
 *   - no I/O, no database, no network
 *   - no `Date.now()`, no argless `new Date()`. The reference date is a
 *     parameter. TSFE depends on it directly, so a clock-reading engine would
 *     produce output that changes between a test run and the same run tomorrow.
 *   - no mutation of inputs
 *   - deterministic: identical input → byte-identical output, including the
 *     ordering of `topContributors` and `escalations`
 *
 * THIS DOES NOT DIAGNOSE. It ranks workers for screening priority. See
 * RISK_MODEL.md §1 for the precise scope of what the tier means and does not.
 */

import {
  CONTROL_MODIFIERS,
  JEM_VERSION,
  MIN_CONTROL_PRODUCT,
  getJemEntry,
  resolveTaskCode,
  type JemTaskCode,
} from './jem';
import { buildReason } from './explain';
import type {
  EscalationCode,
  IntensityOverrides,
  EscalationReason,
  ExposureSegmentInput,
  RiskEngineInput,
  RiskResult,
  TaskContribution,
  Tier,
} from './types';

export const MODEL_VERSION = 'risk-model-0.1.0';

// --- Thresholds -------------------------------------------------------------
// See RISK_MODEL.md §6. Only the 4.0 boundary is a literature value (Howlett
// et al., Thorax 2024, reference category = 40 years at 0.10 mg/m³, ~42%
// absolute risk in mining cohorts). 1.0 and 2.0 are calibration choices.

const TIER_2_THRESHOLD = 1.0;
const TIER_3_THRESHOLD = 2.0;
const TIER_4_THRESHOLD = 4.0;

/** RISK_MODEL.md §8 — all four are calibration choices with no literature backing. */
const RESCREEN_MONTHS: Readonly<Record<Tier, number>> = {
  1: 60,
  2: 36,
  3: 24,
  4: 12,
};

/**
 * PEAK INTENSITY IS NOT MODELLED AT v1.
 *
 * There was a `peakIntensity >= 0.5` escalation here. It fired for zero of 500
 * workers, because the matrix ceiling is 0.28 × 1.2 = 0.336 — the threshold sat
 * above anything the JEM could produce. It has been deleted rather than
 * retuned: a rule that appears in the specification and never fires implies a
 * safeguard that does not exist.
 *
 * `peakIntensity` is still COMPUTED and REPORTED, because a reviewer asking
 * "what was this worker's worst exposure concentration" deserves an answer, and
 * because Buchanan et al. 2003 is good evidence that peak matters independently
 * of cumulative dose. It simply does not drive a tier today. Reinstating it
 * needs a sourced JEM first, not a lower number. See RISK_MODEL.md §7.2.
 */

/**
 * Latency threshold, in years since first exposure.
 *
 * Set at the observed tenure floor among silicotic Jodhpur workers
 * (Rajavel et al. 2020). See the cessation condition below — this threshold
 * alone is NOT sufficient to fire the rule.
 */
const LATENCY_THRESHOLD_YEARS = 15;

/** Normalisation basis for the duration term: an 8-hour day, 12-month year. */
const REFERENCE_HOURS_PER_DAY = 8;
const MONTHS_PER_YEAR = 12;

/**
 * Self-reported hours above this are clamped. RISK_MODEL.md §3.1 — uncapped, a
 * reported 16-hour day applies a 2.0× multiplier on top of an already uncertain
 * intensity, and extreme self-reported hours are the least reliable field in
 * the interview.
 */
const MAX_HOURS_PER_DAY = 12;

/**
 * Maximum tiers an escalation can add. RISK_MODEL.md §7.1 — THIS IS THE
 * UNRESOLVED SPECIFICATION DECISION.
 *
 * The brief says "bump one tier, cap at 4" while also requiring tests for
 * escalations "in isolation and in combination", which are in tension.
 *
 * Escalations are additive here, capped at +2. Without the sub-cap a worker
 * with CE = 0.3 who smokes, had TB, and has 20 years since first exposure jumps
 * Tier 1 → Tier 4, and the system stops being an exposure gate. With it,
 * cumulative exposure stays the dominant term: a Tier 1 worker can reach Tier 3
 * on non-exposure grounds but never Priority.
 *
 * Set to 1 for single-bump semantics, or 4 for uncapped. Either change requires
 * regenerating the golden file, which is the point — the effect on the cohort
 * becomes visible rather than silent.
 */
export const ESCALATION_MAX_STEPS = 2;

/**
 * Evaluation order, strongest evidence first (RISK_MODEL.md §7.2). This is the
 * order in which rules claim the limited escalation steps, so the weakest-
 * evidence rule — current smoking, where the literature is genuinely mixed — is
 * the first to be dropped when the cap binds. Also makes output deterministic.
 */
export const ESCALATION_PRECEDENCE: readonly EscalationCode[] = [
  'PRIOR_TB',
  'LATENCY',
  'CURRENT_SMOKER',
];

// --- Small helpers ----------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Year from an ISO date string, without constructing a `Date`.
 *
 * CLAUDE.md §9 forbids building a Date from a bare year without UTC, and any
 * Date-based parse here would make the engine's output depend on the runner's
 * timezone — `new Date('2026-01-01').getFullYear()` is 2025 west of UTC.
 * Slicing the string sidesteps the entire class of bug.
 */
export function referenceYearOf(referenceDate: string): number {
  const year = Number.parseInt(referenceDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) {
    throw new Error(
      `referenceDate must be an ISO date string starting with a 4-digit year, got: ${referenceDate}`,
    );
  }
  return year;
}

// --- Control modifiers ------------------------------------------------------

/**
 * Product of control modifiers for a segment, floored at MIN_CONTROL_PRODUCT.
 *
 * `m_method` is skipped when the task code already encodes wet/dry, otherwise
 * suppression is counted twice — DRILL_WET at 0.05 would become 0.025, a silent
 * 2× error in the under-triage direction, on exactly the workers the system
 * exists to find. See JEM_SOURCES.md §5.1.
 */
export function controlModifier(
  segment: ExposureSegmentInput,
  taskCode: JemTaskCode,
): number {
  const entry = getJemEntry(taskCode);

  const method = entry.methodEncoded
    ? 1
    : CONTROL_MODIFIERS.method[segment.method];

  const product =
    method *
    CONTROL_MODIFIERS.enclosure[segment.enclosure] *
    CONTROL_MODIFIERS.ppe[segment.ppeUse] *
    CONTROL_MODIFIERS.site[segment.siteType];

  return Math.max(MIN_CONTROL_PRODUCT, product);
}

// --- Duration and overlap ---------------------------------------------------

interface ResolvedSegment {
  taskCode: JemTaskCode;
  intensity: number;
  startYear: number;
  endYear: number;
  /** Fraction of the calendar year worked, from monthsPerYear. */
  occupancy: number;
  /** Day-length multiplier, from hoursPerDay. Never capped by overlap. */
  hoursFactor: number;
  /** FTE years, after overlap scaling. Filled in by `resolveDurations`. */
  durationYears: number;
}

/**
 * Normalise a segment and drop it if it cannot contribute.
 *
 * Returns null for segments that start after the reference date, or whose end
 * precedes their start. Both should have been rejected by the Zod boundary; the
 * engine refuses them defensively because a negative duration would *reduce*
 * cumulative exposure, which is a far worse failure than ignoring a bad row.
 */
function resolveSegment(
  segment: ExposureSegmentInput,
  referenceYear: number,
  intensityOverrides: IntensityOverrides,
): ResolvedSegment | null {
  if (!Number.isFinite(segment.startYear)) return null;
  if (segment.startYear > referenceYear) return null;

  // `endYear: null` means ongoing — resolved to the reference year, never "now".
  const rawEnd = segment.endYear ?? referenceYear;
  const endYear = Math.min(rawEnd, referenceYear);
  if (endYear < segment.startYear) return null;

  const taskCode = resolveTaskCode(segment.taskCode);
  // An override replaces the matrix value for this run only. Nothing is
  // mutated — the same engine call with no overrides still returns the
  // committed answer, which is what makes sensitivity analysis safe to run
  // against a live cohort.
  const baseIntensity =
    intensityOverrides[taskCode] ?? getJemEntry(taskCode).intensityMgM3;
  const intensity = baseIntensity * controlModifier(segment, taskCode);

  return {
    taskCode,
    intensity,
    startYear: segment.startYear,
    endYear,
    occupancy: clamp(segment.monthsPerYear, 0, MONTHS_PER_YEAR) / MONTHS_PER_YEAR,
    hoursFactor:
      clamp(segment.hoursPerDay, 0, MAX_HOURS_PER_DAY) / REFERENCE_HOURS_PER_DAY,
    durationYears: 0,
  };
}

/**
 * Assign each segment its FTE duration, resolving calendar overlap.
 *
 * RISK_MODEL.md §3.2. Workers commonly report concurrent roles — quarrying in
 * season, dressing stone the rest of the year. Naive summation lets a worker
 * accumulate three years of exposure per calendar year and reach Tier 4
 * spuriously.
 *
 * Scaling is applied to CALENDAR OCCUPANCY (months), not to full FTE. Capping
 * full FTE would also cap the hours-per-day multiplier, silently erasing the
 * extra exposure of a 12-hour day — the opposite of what the term is for. A
 * person cannot work more than twelve months in a year; they can certainly work
 * more than eight hours in a day.
 */
function resolveDurations(segments: ResolvedSegment[]): void {
  const demandByYear = new Map<number, number>();

  for (const segment of segments) {
    for (let year = segment.startYear; year <= segment.endYear; year++) {
      demandByYear.set(year, (demandByYear.get(year) ?? 0) + segment.occupancy);
    }
  }

  for (const segment of segments) {
    let occupiedYears = 0;
    for (let year = segment.startYear; year <= segment.endYear; year++) {
      const demand = demandByYear.get(year) ?? 0;
      const scale = demand > 1 ? 1 / demand : 1;
      occupiedYears += segment.occupancy * scale;
    }
    segment.durationYears = occupiedYears * segment.hoursFactor;
  }
}

// --- Tiering and escalation -------------------------------------------------

/** Lower-inclusive, upper-exclusive. Applied to the 2dp-rounded value. */
export function tierForExposure(cumulativeExposure: number): Tier {
  if (cumulativeExposure < TIER_2_THRESHOLD) return 1;
  if (cumulativeExposure < TIER_3_THRESHOLD) return 2;
  if (cumulativeExposure < TIER_4_THRESHOLD) return 3;
  return 4;
}

function satisfiedEscalations(
  input: RiskEngineInput,
  yearsSinceFirstExposure: number,
  exposureEnded: boolean,
): EscalationCode[] {
  const fired = new Set<EscalationCode>();

  if (input.worker.priorTB) fired.add('PRIOR_TB');
  if (input.worker.smokingStatus === 'current') fired.add('CURRENT_SMOKER');

  /**
   * LATENCY — post-cessation progression.
   *
   * Requires BOTH a long interval since first exposure AND that exposure has
   * stopped.
   *
   * The cessation condition is the whole point of the rule. Long service on
   * its own is not new information: it is already in cumulative exposure,
   * which is literally intensity × duration. Firing on tenure alone counted
   * the same fact twice and let a worker's years push their tier up alongside
   * the exposure those same years produced.
   *
   * What tenure does NOT capture is that silicosis progresses after exposure
   * ends. For a worker still in the quarry, CE keeps rising and the model
   * keeps tracking them. For a worker who left, CE is frozen at whatever it
   * reached — but the disease is not. That worker is the one whose exposure
   * figure understates their risk, and that is the only case this rule now
   * covers.
   */
  if (exposureEnded && yearsSinceFirstExposure >= LATENCY_THRESHOLD_YEARS) {
    fired.add('LATENCY');
  }

  return ESCALATION_PRECEDENCE.filter((code) => fired.has(code));
}

// --- Public entry point -----------------------------------------------------

export function assessRisk(input: RiskEngineInput): RiskResult {
  const referenceYear = referenceYearOf(input.referenceDate);

  const intensityOverrides = input.intensityOverrides ?? {};

  const resolved = input.segments
    .map((segment) => resolveSegment(segment, referenceYear, intensityOverrides))
    .filter((segment): segment is ResolvedSegment => segment !== null);

  resolveDurations(resolved);

  // --- Cumulative exposure, peak, latency ---
  let rawCumulative = 0;
  let rawPeak = 0;
  let firstYear: number | null = null;
  let lastYear: number | null = null;

  for (const segment of resolved) {
    rawCumulative += segment.intensity * segment.durationYears;
    // Peak is a property of concentration, not of dose, so duration is
    // irrelevant here. A short stint of dry drilling still sets the peak.
    // Reported for review; no longer drives a tier. See the note above.
    rawPeak = Math.max(rawPeak, segment.intensity);
    firstYear =
      firstYear === null ? segment.startYear : Math.min(firstYear, segment.startYear);
    lastYear = lastYear === null ? segment.endYear : Math.max(lastYear, segment.endYear);
  }

  const cumulativeExposure = round2(rawCumulative);
  const peakIntensity = round2(rawPeak);
  const yearsSinceFirstExposure = firstYear === null ? 0 : referenceYear - firstYear;
  const yearsSinceLastExposure = lastYear === null ? 0 : referenceYear - lastYear;

  /**
   * Has the worker left dusty work?
   *
   * `resolveSegment` clamps an ongoing segment (`endYear: null`) to the
   * reference year, so any segment still running this year makes this false.
   * A worker with no segments at all has not "ended" exposure — they have no
   * recorded exposure, which is a different thing and is flagged separately.
   */
  const exposureEnded = lastYear !== null && lastYear < referenceYear;

  // --- Contributions, aggregated by task ---
  interface TaskTotals {
    contribution: number;
    fteYears: number;
    /** Union of calendar years, so concurrent segments count a year once. */
    calendarYears: Set<number>;
  }

  const byTask = new Map<JemTaskCode, TaskTotals>();
  for (const segment of resolved) {
    const existing = byTask.get(segment.taskCode) ?? {
      contribution: 0,
      fteYears: 0,
      calendarYears: new Set<number>(),
    };
    existing.contribution += segment.intensity * segment.durationYears;
    existing.fteYears += segment.durationYears;
    for (let year = segment.startYear; year <= segment.endYear; year++) {
      existing.calendarYears.add(year);
    }
    byTask.set(segment.taskCode, existing);
  }

  const topContributors: TaskContribution[] = [...byTask.entries()]
    .map(([taskCode, totals]) => ({
      taskCode,
      contribution: round2(totals.contribution),
      percentOfTotal:
        rawCumulative > 0 ? round1((totals.contribution / rawCumulative) * 100) : 0,
      fteYears: round1(totals.fteYears),
      calendarYears: totals.calendarYears.size,
    }))
    // Ties broken by taskCode ascending so output is byte-stable.
    .sort((a, b) =>
      b.contribution !== a.contribution
        ? b.contribution - a.contribution
        : a.taskCode.localeCompare(b.taskCode),
    )
    .slice(0, 3);

  // --- Tiering ---
  const baseTier = tierForExposure(cumulativeExposure);

  const fired = satisfiedEscalations(input, yearsSinceFirstExposure, exposureEnded);
  const appliedSteps = Math.min(fired.length, ESCALATION_MAX_STEPS);
  const escalations: EscalationReason[] = fired.map((code, index) => ({
    code,
    applied: index < appliedSteps,
  }));

  // Never de-escalates: `appliedSteps` is non-negative and the result is
  // floored by `baseTier` through addition, then hard-capped at 4.
  const tier = Math.min(4, baseTier + appliedSteps) as Tier;

  const insufficientData = resolved.length === 0;

  const reason = buildReason({
    tier,
    cumulativeExposure,
    topContributors,
    escalations,
    insufficientData,
  });

  return {
    cumulativeExposure,
    peakIntensity,
    yearsSinceFirstExposure,
    yearsSinceLastExposure,
    exposureEnded,
    baseTier,
    tier,
    escalations,
    rescreenMonths: RESCREEN_MONTHS[tier],
    topContributors,
    reasonEn: reason.en,
    reasonHi: reason.hi,
    modelVersion: MODEL_VERSION,
    jemVersion: JEM_VERSION,
    confidence: 'provisional',
    insufficientData,
  };
}
