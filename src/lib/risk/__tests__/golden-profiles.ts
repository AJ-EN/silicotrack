/**
 * Twenty fixed worker profiles for the golden-file test.
 *
 * These are SYNTHETIC. No real worker is represented. Scenarios are shaped by
 * the occupational structure reported in Rajavel et al. 2020 for Jodhpur
 * sandstone mines — men predominantly cutting and drilling, women predominantly
 * loading and clearing waste, mean tenure ~19 years — so the fixture exercises
 * the model over the population it is actually aimed at.
 *
 * Any model change that alters the expected output for these profiles must be
 * deliberate, reviewed, and explained in the commit message. An unexplained
 * golden diff is a defect, not a test update.
 */

import type { ExposureSegmentInput, RiskEngineInput, WorkerRiskFacts } from '../types';

/** Frozen. Never the system clock — see engine.ts purity contract. */
export const GOLDEN_REFERENCE_DATE = '2026-08-13';

const CLEAN: WorkerRiskFacts = { smokingStatus: 'never', priorTB: false };

function seg(
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

export interface GoldenProfile {
  id: string;
  description: string;
  input: RiskEngineInput;
}

function profile(
  id: string,
  description: string,
  segments: ExposureSegmentInput[],
  worker: WorkerRiskFacts = CLEAN,
): GoldenProfile {
  return {
    id,
    description,
    input: { segments, worker, referenceDate: GOLDEN_REFERENCE_DATE },
  };
}

export const GOLDEN_PROFILES: readonly GoldenProfile[] = [
  profile('P01', 'New quarry loader, three seasons, nothing else', [
    seg({ taskCode: 'LOAD', startYear: 2024, endYear: 2026 }),
  ]),

  profile('P02', 'Registered but never interviewed — no exposure segments', []),

  profile(
    'P03',
    'Demo narrative: twelve years of dry drilling, asymptomatic, would be rejected at CHC',
    [seg({ taskCode: 'DRILL_DRY', startYear: 2015, endYear: 2026 })],
  ),

  profile('P04', 'Seasonal migrant, six months a year for twenty years', [
    seg({ taskCode: 'CUT_DRY', startYear: 2007, endYear: 2026, monthsPerYear: 6 }),
  ]),

  profile('P05', 'Ongoing wet driller with consistent controls, twenty-five years', [
    seg({
      taskCode: 'DRILL_WET',
      startYear: 2002,
      endYear: null,
      method: 'wet',
      enclosure: 'enclosed',
      ppeUse: 'consistent',
    }),
  ]),

  profile('P06', 'Concurrent roles: drilling and dressing across the same fifteen years', [
    seg({ taskCode: 'DRILL_DRY', startYear: 2012, endYear: 2026 }),
    seg({ taskCode: 'DRESS', startYear: 2012, endYear: 2026 }),
  ]),

  profile('P07', 'Career haulage driver, thirty-five years, partial cab enclosure', [
    seg({ taskCode: 'HAUL', startYear: 1992, endYear: 2026, enclosure: 'enclosed' }),
  ]),

  profile('P08', 'Female worker: loading and waste clearing, twenty-two years', [
    seg({ taskCode: 'LOAD', startYear: 2005, endYear: 2026, monthsPerYear: 8 }),
    seg({ taskCode: 'CLEAN_WASTE', startYear: 2005, endYear: 2026, monthsPerYear: 4 }),
  ]),

  profile('P09', 'Workshop carver, twenty years in a poorly ventilated enclosed space', [
    seg({ taskCode: 'CARVE', startYear: 2007, endYear: 2026, enclosure: 'enclosed' }),
  ]),

  profile('P10', 'Dry polisher, eight years, intermittent respirator use', [
    seg({ taskCode: 'POLISH', startYear: 2019, endYear: 2026, ppeUse: 'intermittent' }),
  ]),

  profile('P11', 'Crusher operator, fifteen years downwind of the plant', [
    seg({ taskCode: 'CRUSH', startYear: 2012, endYear: 2026 }),
  ]),

  profile(
    'P12',
    'Departed worker: dry drilling 1985-2000, left the industry twenty-six years ago',
    [seg({ taskCode: 'DRILL_DRY', startYear: 1985, endYear: 2000 })],
  ),

  profile(
    'P13',
    'Prior TB with moderate exposure — silicotuberculosis phenotype',
    [seg({ taskCode: 'CUT_DRY', startYear: 2014, endYear: 2026 })],
    { smokingStatus: 'never', priorTB: true },
  ),

  profile(
    'P14',
    'Every escalation fires: left dusty work in 2015, current smoker, prior TB',
    // Must have ENDED exposure — LATENCY no longer fires on tenure alone.
    [seg({ taskCode: 'CUT_DRY', startYear: 1996, endYear: 2015 })],
    { smokingStatus: 'current', priorTB: true },
  ),

  profile('P15', 'Mixed career: drilling, then dressing, then loading', [
    seg({ taskCode: 'DRILL_DRY', startYear: 1998, endYear: 2007 }),
    seg({ taskCode: 'DRESS', startYear: 2008, endYear: 2017 }),
    seg({ taskCode: 'LOAD', startYear: 2018, endYear: 2026 }),
  ]),

  profile('P16', 'Twelve-hour days of dry cutting for ten years', [
    seg({ taskCode: 'CUT_DRY', startYear: 2017, endYear: 2026, hoursPerDay: 12 }),
  ]),

  profile('P17', 'Legacy record with an unrecognised task code', [
    seg({ taskCode: 'LEGACY_UNKNOWN_TASK', startYear: 2011, endYear: 2026 }),
  ]),

  profile(
    'P18',
    'Forty-year career across the full task range, former smoker',
    [
      seg({ taskCode: 'DRILL_DRY', startYear: 1987, endYear: 1996 }),
      seg({ taskCode: 'CUT_DRY', startYear: 1997, endYear: 2006 }),
      seg({ taskCode: 'CRUSH', startYear: 2007, endYear: 2016 }),
      seg({ taskCode: 'DRESS', startYear: 2017, endYear: 2026 }),
    ],
    { smokingStatus: 'former', priorTB: false },
  ),

  profile('P19', 'Underground dresser, eighteen years, no controls', [
    seg({ taskCode: 'DRESS', startYear: 2009, endYear: 2026, siteType: 'underground' }),
  ]),

  profile(
    'P20',
    'Single season of wet cutting with full controls — the floor of the model',
    [
      seg({
        taskCode: 'CUT_WET',
        startYear: 2026,
        endYear: 2026,
        method: 'wet',
        enclosure: 'enclosed',
        ppeUse: 'consistent',
        monthsPerYear: 3,
      }),
    ],
  ),
];
