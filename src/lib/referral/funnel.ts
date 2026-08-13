/**
 * Referral drop-off analytics.
 *
 * Pure functions. No I/O, no clock — elapsed time comes from the recorded gaps
 * between transitions, never from the current date, so the same data produces
 * the same funnel tomorrow.
 *
 * The measure that matters is REACHED, not CURRENT STATUS. Asking "how many
 * referrals are sitting at RADIOLOGIST today" describes a queue. Asking "how
 * many ever reached RADIOLOGIST" describes a pipeline, and the difference
 * between consecutive stages is the loss at each one. The state records the
 * transitions and reports neither.
 */

import {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  isPaymentGap,
  isPipelineComplete,
  isStalled,
  isTerminalStage,
  stageIndex,
  type PipelineStage,
  type TerminalStage,
} from './stages';

export interface StageEventRecord {
  stage: string;
  /** ISO instant. Used only for ordering. */
  enteredAt: string;
  /** Days spent in the stage immediately before this transition. */
  daysInPreviousStage: number | null;
}

export interface ReferralRecord {
  id: string;
  status: string;
  daysInStage: number;
  stageHistory: readonly StageEventRecord[];
}

export interface FunnelStage {
  stage: PipelineStage;
  /** Referrals that ever reached this stage. */
  reached: number;
  /** Share of all referrals, 1dp. */
  reachedShare: number;
  /** reached(this) − reached(next). Zero at the final stage. */
  lost: number;
  /**
   * What the gap after this stage means.
   *
   * `attrition` — a worker who fell out is a case not found.
   * `awaiting_payment` — the CERTIFIED → DISBURSED gap. Those workers WERE
   *   found; they are owed compensation. Reporting this as drop-off would
   *   overstate detection failure and bury a payment failure inside it.
   */
  lossKind: 'attrition' | 'awaiting_payment';
  /** Lost as a share of those who reached this stage, 1dp. */
  lostShare: number;
  /** Referrals sitting here right now. */
  current: number;
  /** Of those sitting here, how many are past the stall threshold. */
  stalled: number;
  /** Median days spent here before moving on. Null when nobody has moved on. */
  medianDays: number | null;
}

export interface TerminalOutcome {
  stage: TerminalStage;
  count: number;
  share: number;
  /** Which pipeline stage they were lost from, most common first. */
  lostFrom: { stage: PipelineStage; count: number }[];
}

export interface Funnel {
  total: number;
  stages: FunnelStage[];
  terminal: TerminalOutcome[];
  stalledTotal: number;
  certifiedTotal: number;
  /** Certified but not yet disbursed. A payment failure, not a detection one. */
  awaitingPayment: number;
  /** Still moving: neither terminal nor certified. */
  inProgress: number;
  /**
   * The single largest stage-to-stage loss. This is the headline number — the
   * one place the pipeline leaks hardest.
   */
  biggestLoss: { stage: PipelineStage; lost: number; lostShare: number } | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const low = sorted[middle - 1];
  const high = sorted[middle];
  if (low === undefined || high === undefined) return null;
  return Math.round(((low + high) / 2) * 10) / 10;
}

function share(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function buildFunnel(referrals: readonly ReferralRecord[]): Funnel {
  const total = referrals.length;

  const reachedCount = new Map<string, number>();
  const currentCount = new Map<string, number>();
  const stalledCount = new Map<string, number>();
  const durations = new Map<string, number[]>();

  const terminalCount = new Map<string, number>();
  const terminalOrigin = new Map<string, Map<string, number>>();

  for (const referral of referrals) {
    const history = [...referral.stageHistory].sort((a, b) =>
      a.enteredAt.localeCompare(b.enteredAt),
    );

    // A referral counts once per stage however many times it passed through —
    // a record bounced back for correction must not inflate the funnel.
    const seen = new Set<string>();
    for (const event of history) {
      if (seen.has(event.stage)) continue;
      seen.add(event.stage);
      reachedCount.set(event.stage, (reachedCount.get(event.stage) ?? 0) + 1);
    }

    /**
     * Time in each stage, from consecutive pairs.
     *
     * Read pairwise rather than trusting `daysInPreviousStage` to be globally
     * consistent: the gap recorded on event B is the time spent in event A's
     * stage, and taking it from the pair makes that relationship explicit
     * rather than assumed.
     */
    for (let i = 0; i < history.length - 1; i++) {
      const from = history[i];
      const to = history[i + 1];
      if (from === undefined || to === undefined) continue;
      const days = to.daysInPreviousStage;
      if (days === null) continue;
      const list = durations.get(from.stage) ?? [];
      list.push(days);
      durations.set(from.stage, list);
    }

    currentCount.set(referral.status, (currentCount.get(referral.status) ?? 0) + 1);

    if (isStalled(referral.status, referral.daysInStage)) {
      stalledCount.set(referral.status, (stalledCount.get(referral.status) ?? 0) + 1);
    }

    if (isTerminalStage(referral.status)) {
      terminalCount.set(referral.status, (terminalCount.get(referral.status) ?? 0) + 1);

      // Where were they when they dropped out? The last pipeline stage they
      // reached before the terminal event.
      const lastPipeline = [...history]
        .reverse()
        .find((event) => stageIndex(event.stage) >= 0);
      if (lastPipeline !== undefined) {
        const origins = terminalOrigin.get(referral.status) ?? new Map<string, number>();
        origins.set(lastPipeline.stage, (origins.get(lastPipeline.stage) ?? 0) + 1);
        terminalOrigin.set(referral.status, origins);
      }
    }
  }

  const stages: FunnelStage[] = PIPELINE_STAGES.map((stage, index) => {
    const reached = reachedCount.get(stage) ?? 0;
    const next = PIPELINE_STAGES[index + 1];
    const reachedNext = next === undefined ? reached : (reachedCount.get(next) ?? 0);
    // Clamped: a data anomaly must not render a negative bar.
    const lost = Math.max(0, reached - reachedNext);

    return {
      stage,
      reached,
      reachedShare: share(reached, total),
      lost,
      lossKind: isPaymentGap(stage) ? 'awaiting_payment' : 'attrition',
      lostShare: share(lost, reached),
      current: currentCount.get(stage) ?? 0,
      stalled: stalledCount.get(stage) ?? 0,
      medianDays: median(durations.get(stage) ?? []),
    };
  });

  const terminal: TerminalOutcome[] = TERMINAL_STAGES.map((stage) => {
    const origins = terminalOrigin.get(stage) ?? new Map<string, number>();
    return {
      stage,
      count: terminalCount.get(stage) ?? 0,
      share: share(terminalCount.get(stage) ?? 0, total),
      lostFrom: [...origins.entries()]
        .filter(([name]) => stageIndex(name) >= 0)
        .map(([name, count]) => ({ stage: name as PipelineStage, count }))
        .sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    };
  }).sort((a, b) => b.count - a.count);

  const stalledTotal = referrals.filter((referral) =>
    isStalled(referral.status, referral.daysInStage),
  ).length;

  const certifiedTotal = reachedCount.get('CERTIFIED') ?? 0;

  const inProgress = referrals.filter(
    (referral) => !isPipelineComplete(referral.status) && referral.status !== 'CERTIFIED',
  ).length;

  /**
   * Workers certified but not yet paid. Reported separately from drop-off
   * because it is a different failure with a different owner.
   */
  const awaitingPayment = Math.max(
    0,
    (reachedCount.get('CERTIFIED') ?? 0) - (reachedCount.get('DISBURSED') ?? 0),
  );

  // The headline describes DETECTION attrition, so the payment gap is excluded
  // — otherwise a disbursement backlog could present itself as the pipeline's
  // worst leak. The last stage is excluded too: it has no successor, so its
  // "loss" is undefined rather than zero.
  const losses = stages
    .slice(0, -1)
    .filter((stage) => stage.lost > 0 && stage.lossKind === 'attrition');
  const biggest = losses.reduce<FunnelStage | null>(
    (worst, stage) => (worst === null || stage.lost > worst.lost ? stage : worst),
    null,
  );

  return {
    total,
    stages,
    terminal,
    stalledTotal,
    certifiedTotal,
    awaitingPayment,
    inProgress,
    biggestLoss:
      biggest === null
        ? null
        : { stage: biggest.stage, lost: biggest.lost, lostShare: biggest.lostShare },
  };
}
