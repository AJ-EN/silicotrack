/**
 * The Raj Silicosis portal pipeline, as the state actually models it.
 *
 * These eight stages and three terminal states mirror the real portal exactly
 * (CLAUDE.md §5). The mapping is deliberately literal: a comparison of
 * drop-off is only meaningful if the stages being compared are the state's own,
 * not a convenient re-slicing of them.
 *
 * The state records these transitions internally. It does not report loss at
 * each one. Measuring that is the point of this module.
 */

export const PIPELINE_STAGES = [
  'REGISTERED',
  'PRIMARY_CHECKUP',
  'RADIOGRAPHER',
  'RADIOLOGIST',
  'MO_APPROVAL',
  'BOARD',
  'CERTIFIED',
  'DISBURSED',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * Exits from the pipeline.
 *
 * REJECTED_NO_SYMPTOMS is the one that matters. It is the state's single
 * largest bucket — 11,288 of 21,871 applications, 57.6% — and it rejects
 * applicants for lacking symptoms in a disease that is asymptomatic in exactly
 * the stage worth catching. The whole project exists because of this value.
 */
export const TERMINAL_STAGES = [
  'REJECTED_NO_SYMPTOMS',
  'REJECTED_POST_XRAY',
  'LOST_TO_FOLLOWUP',
] as const;

export type TerminalStage = (typeof TERMINAL_STAGES)[number];
export type ReferralStage = PipelineStage | TerminalStage;

/**
 * Days in one stage before a referral is flagged as stalled. `[CAL]`
 *
 * No published service standard for the Rajasthan pipeline was found. Two
 * weeks is an operational judgement: long enough not to flag normal
 * administrative turnaround, short enough that a coordinator can still act
 * before a worker stops answering the phone.
 */
export const STALLED_DAYS = 14;

export function isPipelineStage(stage: string): stage is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(stage);
}

export function isTerminalStage(stage: string): stage is TerminalStage {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

/** Position in the pipeline, or -1 for terminal and unknown values. */
export function stageIndex(stage: string): number {
  return (PIPELINE_STAGES as readonly string[]).indexOf(stage);
}

/** The last stage in the pipeline. Nothing follows it. */
export const FINAL_STAGE: PipelineStage = 'DISBURSED';

/**
 * Is there anything left to do on this referral?
 *
 * Complete means rejected, lost, OR disbursed. DISBURSED belongs here as much
 * as the terminal states do: the worker has been certified and paid, and a
 * referral sitting there for eighty days is finished, not delayed.
 */
export function isPipelineComplete(status: string): boolean {
  return isTerminalStage(status) || status === FINAL_STAGE;
}

/**
 * Statuses with nothing left to do. Exported so a SQL `notIn` filter and the
 * pure `isStalled` check cannot drift apart.
 */
export const COMPLETE_STAGES: readonly string[] = [...TERMINAL_STAGES, FINAL_STAGE];

/**
 * A referral is stalled when it has sat in one actionable stage too long.
 *
 * Completed referrals are excluded by design. A rejected, lost or fully
 * disbursed referral is not "stalled", it is finished, and counting it would
 * bury the referrals a coordinator can still rescue under a pile of ones they
 * cannot.
 *
 * CERTIFIED deliberately REMAINS stallable. A worker certified months ago and
 * still unpaid is a real, actionable failure — the compensation delay the
 * state has been criticised for — and hiding it would be as dishonest as
 * flagging the disbursed ones.
 */
export function isStalled(status: string, daysInStage: number): boolean {
  if (isPipelineComplete(status)) return false;
  return daysInStage > STALLED_DAYS;
}

/**
 * Does the gap after this stage represent people lost, or people waiting to be
 * paid?
 *
 * Everything up to certification is DETECTION attrition — a worker who fell
 * out is a case not found. The CERTIFIED → DISBURSED gap is something else
 * entirely: those workers were found, and are owed money. Both matter, and
 * presenting them as one number would overstate detection failure while
 * burying a payment failure inside it.
 */
export function isPaymentGap(stage: string): boolean {
  return stage === 'CERTIFIED';
}

/**
 * Did this referral end in certification?
 *
 * CERTIFIED and DISBURSED both count. Disbursement is a payment step after
 * certification, not a separate clinical outcome.
 */
export function isCertifiedOutcome(status: string): boolean {
  return status === 'CERTIFIED' || status === 'DISBURSED';
}
