import type {
  ExposureSegmentInput,
  RiskEngineInput,
  WorkerRiskFacts,
} from '../types';

/**
 * Fixed reference date for every test.
 *
 * The engine takes this as a parameter precisely so tests never depend on the
 * clock. A suite that passed today and failed tomorrow would be worthless for a
 * model whose latency term is measured in years.
 */
export const REF_DATE = '2026-08-13';
export const REF_YEAR = 2026;

/** Neutral worker: nothing that could trigger an escalation. */
export const CLEAN_WORKER: WorkerRiskFacts = {
  smokingStatus: 'never',
  priorTB: false,
};

/**
 * Segment builder with neutral-control defaults, so a control product of 1.0
 * is the baseline and any test that cares about modifiers states them
 * explicitly.
 */
export function segment(
  overrides: Partial<ExposureSegmentInput> &
    Pick<ExposureSegmentInput, 'taskCode' | 'startYear'>,
): ExposureSegmentInput {
  return {
    method: 'dry',
    enclosure: 'open',
    ppeUse: 'none',
    siteType: 'surface',
    endYear: null,
    monthsPerYear: 12,
    hoursPerDay: 8,
    ...overrides,
  };
}

export function input(
  segments: ExposureSegmentInput[],
  worker: WorkerRiskFacts = CLEAN_WORKER,
  referenceDate: string = REF_DATE,
): RiskEngineInput {
  return { segments, worker, referenceDate };
}
