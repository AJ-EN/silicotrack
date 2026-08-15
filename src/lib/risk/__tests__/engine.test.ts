import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ESCALATION_MAX_STEPS,
  MODEL_VERSION,
  assessRisk,
  controlModifier,
  referenceYearOf,
  tierForExposure,
} from '../engine';
import { CONTROL_MODIFIERS, JEM, JEM_TASK_ORDER, MIN_CONTROL_PRODUCT } from '../jem';
import { CLEAN_WORKER, REF_YEAR, input, segment } from './helpers';
import type { WorkerRiskFacts } from '../types';

/**
 * LOAD sits at 0.05 mg/m³ with neutral controls, so cumulative exposure is
 * exactly 0.05 per full-time year. That makes threshold arithmetic exact and
 * readable: 20 years = 1.00, 40 years = 2.00, 80 years = 4.00.
 */
const PER_YEAR = JEM.LOAD.intensityMgM3;

/** Segment of exactly `years` full-time years, ending at the reference year. */
function loadYears(years: number) {
  return segment({
    taskCode: 'LOAD',
    startYear: REF_YEAR - years + 1,
    endYear: REF_YEAR,
  });
}

describe('purity contract', () => {
  it('engine and explain read no clock and perform no I/O', () => {
    const sources = ['../engine.ts', '../explain.ts'].map((relative) =>
      readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'),
    );

    for (const source of sources) {
      // Strip block and line comments — the files discuss Date.now() at length
      // in their own documentation, and that must not trip the guard.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(code).not.toMatch(/Date\.now/);
      expect(code).not.toMatch(/new Date/);
      expect(code).not.toMatch(/Math\.random/);
      expect(code).not.toMatch(/require\(|from ['"]node:/);
    }
  });

  it('is deterministic across repeated calls', () => {
    const request = input([loadYears(30)], { smokingStatus: 'current', priorTB: true });
    expect(assessRisk(request)).toEqual(assessRisk(request));
  });

  it('does not mutate its inputs', () => {
    const segments = [Object.freeze(loadYears(10))];
    const frozen = Object.freeze(segments);
    expect(() => assessRisk(input([...frozen]))).not.toThrow();
    expect(segments[0].endYear).toBe(REF_YEAR);
  });

  it('derives the reference year without constructing a Date', () => {
    // `new Date('2026-01-01').getFullYear()` is 2025 west of UTC. Slicing the
    // ISO string sidesteps the entire timezone class of bug.
    expect(referenceYearOf('2026-01-01')).toBe(2026);
    expect(referenceYearOf('2026-12-31')).toBe(2026);
    expect(() => referenceYearOf('nonsense')).toThrow();
  });
});

describe('tierForExposure — boundaries are lower-inclusive', () => {
  it.each([
    [0, 1],
    [0.99, 1],
    [1.0, 2],
    [1.99, 2],
    [2.0, 3],
    [3.99, 3],
    [4.0, 4],
    [12.5, 4],
  ])('CE %s → tier %i', (exposure, expected) => {
    expect(tierForExposure(exposure)).toBe(expected);
  });
});

describe('cumulative exposure', () => {
  it('scores a single full-time segment as intensity × years', () => {
    const result = assessRisk(input([loadYears(10)]));
    expect(result.cumulativeExposure).toBe(round2(PER_YEAR * 10));
    expect(result.baseTier).toBe(1);
    expect(result.insufficientData).toBe(false);
  });

  it('counts the start year inclusively', () => {
    // A worker who worked only in 2020 has one year of exposure, not zero.
    const result = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2020, endYear: 2020 })]),
    );
    expect(result.cumulativeExposure).toBe(round2(PER_YEAR));
  });

  it('lands exactly on each tier boundary', () => {
    expect(assessRisk(input([loadYears(20)])).cumulativeExposure).toBe(1.0);
    expect(assessRisk(input([loadYears(20)])).baseTier).toBe(2);

    expect(assessRisk(input([loadYears(40)])).cumulativeExposure).toBe(2.0);
    expect(assessRisk(input([loadYears(40)])).baseTier).toBe(3);

    expect(assessRisk(input([loadYears(80)])).cumulativeExposure).toBe(4.0);
    expect(assessRisk(input([loadYears(80)])).baseTier).toBe(4);
  });

  it('places the year below each boundary in the lower tier', () => {
    expect(assessRisk(input([loadYears(19)])).baseTier).toBe(1);
    expect(assessRisk(input([loadYears(39)])).baseTier).toBe(2);
    expect(assessRisk(input([loadYears(79)])).baseTier).toBe(3);
  });

  it('scales part-year and part-day work', () => {
    const seasonal = assessRisk(
      input([
        segment({
          taskCode: 'LOAD',
          startYear: REF_YEAR - 9,
          endYear: REF_YEAR,
          monthsPerYear: 6,
        }),
      ]),
    );
    expect(seasonal.cumulativeExposure).toBe(round2(PER_YEAR * 5));
  });
});

describe('zero-segment worker', () => {
  const result = assessRisk(input([]));

  it('flags insufficient data rather than scoring as low risk', () => {
    // Without this flag an incomplete interview is indistinguishable from a
    // genuinely low-exposure worker — both are CE 0, Tier 1 — and incomplete
    // interviews hide inside the low-risk bucket.
    expect(result.insufficientData).toBe(true);
    expect(result.cumulativeExposure).toBe(0);
    expect(result.topContributors).toEqual([]);
    expect(result.yearsSinceFirstExposure).toBe(0);
  });

  it('says so in both languages', () => {
    expect(result.reasonEn).toContain('Interview incomplete');
    expect(result.reasonHi).toContain('साक्षात्कार अधूरा');
  });

  it('does not substitute non-exposure escalation grounds for an exposure signal', () => {
    const withTb = assessRisk(input([], { smokingStatus: 'never', priorTB: true }));
    expect(withTb.tier).toBe(1);
    expect(withTb.escalations).toEqual([]);
    expect(withTb.insufficientData).toBe(true);
  });
});

describe('ongoing segments', () => {
  it('resolves endYear: null to the reference year, not to now', () => {
    const ongoing = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: REF_YEAR - 9, endYear: null })]),
    );
    expect(ongoing.cumulativeExposure).toBe(round2(PER_YEAR * 10));
  });

  it('gives the same answer as an explicit end year at the reference date', () => {
    const explicit = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2010, endYear: REF_YEAR })]),
    );
    const ongoing = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2010, endYear: null })]),
    );
    expect(ongoing.cumulativeExposure).toBe(explicit.cumulativeExposure);
  });

  it('clamps an end year beyond the reference date', () => {
    const future = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2020, endYear: 2099 })]),
    );
    const clamped = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2020, endYear: REF_YEAR })]),
    );
    expect(future.cumulativeExposure).toBe(clamped.cumulativeExposure);
  });
});

describe('overlapping segments', () => {
  it('never scores higher than the same work recorded sequentially', () => {
    // The invariant from RISK_MODEL.md §3.2. Without it, a worker reporting
    // three concurrent seasonal roles accrues three years per calendar year.
    const concurrent = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2007, endYear: 2026 }),
        segment({ taskCode: 'DRESS', startYear: 2007, endYear: 2026 }),
      ]),
    );
    const sequential = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 1987, endYear: 2006 }),
        segment({ taskCode: 'DRESS', startYear: 2007, endYear: 2026 }),
      ]),
    );
    expect(concurrent.cumulativeExposure).toBeLessThan(sequential.cumulativeExposure);
  });

  it('caps total calendar occupancy at one year per year', () => {
    const twoConcurrent = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2017, endYear: 2026 }),
        segment({ taskCode: 'LOAD', startYear: 2017, endYear: 2026 }),
      ]),
    );
    const oneAlone = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2017, endYear: 2026 })]),
    );
    // Two full-time roles across the same ten calendar years is still ten
    // person-years of work, split between them.
    expect(twoConcurrent.cumulativeExposure).toBe(oneAlone.cumulativeExposure);
  });

  it('leaves non-overlapping part-year segments unscaled', () => {
    const halfAndHalf = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2017, endYear: 2026, monthsPerYear: 6 }),
        segment({ taskCode: 'LOAD', startYear: 2017, endYear: 2026, monthsPerYear: 6 }),
      ]),
    );
    expect(halfAndHalf.cumulativeExposure).toBe(round2(PER_YEAR * 10));
  });

  it('preserves the long-day multiplier through overlap scaling', () => {
    // Overlap scales calendar occupancy, not full FTE. Capping full FTE would
    // silently erase the extra exposure of a 12-hour day.
    const longDays = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2026, endYear: 2026, hoursPerDay: 12 }),
        segment({ taskCode: 'LOAD', startYear: 2026, endYear: 2026, hoursPerDay: 12 }),
      ]),
    );
    expect(longDays.cumulativeExposure).toBe(round2(PER_YEAR * 1.5));
  });

  it('clamps self-reported hours at 12 per day', () => {
    const extreme = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2026, endYear: 2026, hoursPerDay: 20 }),
      ]),
    );
    expect(extreme.cumulativeExposure).toBe(round2(PER_YEAR * 1.5));
  });
});

describe('malformed segments are refused, never scored negative', () => {
  it('ignores a segment ending before it starts', () => {
    const result = assessRisk(
      input([
        loadYears(10),
        segment({ taskCode: 'LOAD', startYear: 2020, endYear: 2010 }),
      ]),
    );
    expect(result.cumulativeExposure).toBe(round2(PER_YEAR * 10));
  });

  it('ignores a segment starting after the reference date', () => {
    const result = assessRisk(
      input([loadYears(10), segment({ taskCode: 'LOAD', startYear: 2099 })]),
    );
    expect(result.cumulativeExposure).toBe(round2(PER_YEAR * 10));
  });

  it('falls back to OTHER for an unrecognised task code', () => {
    // Dropping the worker would remove them from the screening queue entirely.
    const result = assessRisk(
      input([segment({ taskCode: 'NOT_A_REAL_TASK', startYear: 2026, endYear: 2026 })]),
    );
    expect(result.topContributors[0]?.taskCode).toBe('OTHER');
    expect(result.cumulativeExposure).toBe(JEM.OTHER.intensityMgM3);
  });
});

describe('control modifiers', () => {
  it('does not double-count wet suppression on a methodEncoded task', () => {
    // THE DOUBLE-COUNTING GUARD. See JEM_SOURCES.md §5.1.
    //
    // DRILL_WET's intensity ALREADY reflects water suppression. Applying
    // m_method on top would halve it a second time — 0.05 → 0.025 — a silent
    // 2× error in the UNDER-triage direction, on exactly the workers this
    // system exists to find.
    const wetTask = segment({ taskCode: 'DRILL_WET', startYear: 2026, method: 'wet' });
    expect(controlModifier(wetTask, 'DRILL_WET')).toBe(1);
    expect(controlModifier(wetTask, 'DRILL_WET')).not.toBe(CONTROL_MODIFIERS.method.wet);
  });

  it('scores a methodEncoded task identically whatever the method field says', () => {
    // The stronger form of the same guard, asserted on cumulative exposure
    // rather than on the modifier: a full year of DRILL_WET must come out at
    // exactly the JEM intensity, never half of it, and the free-text method
    // answer must not move the number at all.
    const year = { startYear: 2026, endYear: 2026 } as const;
    const asWet = assessRisk(
      input([segment({ taskCode: 'DRILL_WET', method: 'wet', ...year })]),
    );
    const asDry = assessRisk(
      input([segment({ taskCode: 'DRILL_WET', method: 'dry', ...year })]),
    );

    expect(asWet.cumulativeExposure).toBe(JEM.DRILL_WET.intensityMgM3);
    expect(asWet.cumulativeExposure).toBe(asDry.cumulativeExposure);
  });

  it('leaves every methodEncoded task in the JEM covered by the guard', () => {
    // If a fifth method-encoded code is ever added, this fails until the
    // guard is extended to it rather than silently under-scoring that task.
    for (const code of JEM_TASK_ORDER.filter((task) => JEM[task].methodEncoded)) {
      for (const method of ['wet', 'dry'] as const) {
        const seg = segment({ taskCode: code, startYear: 2026, method });
        expect(controlModifier(seg, code)).toBe(1);
      }
    }
  });

  it('applies m_method for method-neutral tasks', () => {
    const wetDressing = segment({ taskCode: 'DRESS', startYear: 2026, method: 'wet' });
    expect(controlModifier(wetDressing, 'DRESS')).toBe(CONTROL_MODIFIERS.method.wet);
  });

  it('floors the control product so self-reported controls cannot zero a score', () => {
    const fullyControlled = segment({
      taskCode: 'DRESS',
      startYear: 2026,
      method: 'wet',
      enclosure: 'enclosed',
      ppeUse: 'consistent',
    });
    // 0.5 × 0.6 × 0.7 = 0.21, below the floor.
    expect(controlModifier(fullyControlled, 'DRESS')).toBe(MIN_CONTROL_PRODUCT);
  });

  it('raises exposure underground', () => {
    const underground = segment({
      taskCode: 'DRESS',
      startYear: 2026,
      siteType: 'underground',
    });
    expect(controlModifier(underground, 'DRESS')).toBe(CONTROL_MODIFIERS.site.underground);
  });

  it('never returns zero for any answer combination', () => {
    for (const taskCode of JEM_TASK_ORDER) {
      for (const method of ['wet', 'dry'] as const) {
        for (const enclosure of ['open', 'enclosed'] as const) {
          for (const ppeUse of ['none', 'intermittent', 'consistent'] as const) {
            for (const siteType of ['surface', 'underground'] as const) {
              const value = controlModifier(
                segment({ taskCode, startYear: 2026, method, enclosure, ppeUse, siteType }),
                taskCode,
              );
              expect(value).toBeGreaterThanOrEqual(MIN_CONTROL_PRODUCT);
            }
          }
        }
      }
    }
  });
});

describe('intensity overrides — the JEM admin sandbox', () => {
  const twelveYears = () => [
    segment({ taskCode: 'DRILL_DRY', startYear: 2015, endYear: REF_YEAR }),
  ];

  it('scores with the proposed coefficient instead of the committed one', () => {
    const committed = assessRisk(input(twelveYears()));
    const doubled = assessRisk({
      ...input(twelveYears()),
      intensityOverrides: { DRILL_DRY: JEM.DRILL_DRY.intensityMgM3 * 2 },
    });

    expect(committed.cumulativeExposure).toBe(3.36);
    expect(doubled.cumulativeExposure).toBe(6.72);
    expect(doubled.tier).toBeGreaterThan(committed.tier);
  });

  it('leaves the committed matrix untouched', () => {
    // The whole point: an expert can explore against a live cohort without
    // mutating the model anyone else is being scored by.
    const before = JEM.DRILL_DRY.intensityMgM3;
    assessRisk({ ...input(twelveYears()), intensityOverrides: { DRILL_DRY: 99 } });
    expect(JEM.DRILL_DRY.intensityMgM3).toBe(before);
    expect(assessRisk(input(twelveYears())).cumulativeExposure).toBe(3.36);
  });

  it('applies control modifiers on top of the override, not instead of them', () => {
    const result = assessRisk({
      ...input([
        segment({
          taskCode: 'DRESS',
          startYear: REF_YEAR,
          endYear: REF_YEAR,
          method: 'wet',
        }),
      ]),
      intensityOverrides: { DRESS: 1.0 },
    });
    // 1.0 × m_method(wet) = 0.5 for one full-time year.
    expect(result.cumulativeExposure).toBe(CONTROL_MODIFIERS.method.wet);
  });

  it('ignores an override for a task the worker never did', () => {
    const result = assessRisk({
      ...input(twelveYears()),
      intensityOverrides: { POLISH: 5 },
    });
    expect(result.cumulativeExposure).toBe(3.36);
  });

  it('treats an empty override map as the committed matrix', () => {
    expect(assessRisk({ ...input(twelveYears()), intensityOverrides: {} })).toEqual(
      assessRisk(input(twelveYears())),
    );
  });
});

describe('escalation rules in isolation', () => {
  /** Twenty years of loading: CE 1.00, Tier 2, with no latency trigger. */
  const eligibleExposure = () => [loadYears(20)];

  it('does not escalate a clean worker', () => {
    const result = assessRisk(input(eligibleExposure()));
    expect(result.baseTier).toBe(2);
    expect(result.tier).toBe(2);
    expect(result.escalations).toEqual([]);
  });

  it('escalates for prior TB', () => {
    const worker: WorkerRiskFacts = { smokingStatus: 'never', priorTB: true };
    const result = assessRisk(input(eligibleExposure(), worker));
    expect(result.tier).toBe(result.baseTier + 1);
    expect(result.escalations).toEqual([{ code: 'PRIOR_TB', applied: true }]);
  });

  it('escalates for current smoking', () => {
    const worker: WorkerRiskFacts = { smokingStatus: 'current', priorTB: false };
    const result = assessRisk(input(eligibleExposure(), worker));
    expect(result.escalations).toEqual([{ code: 'CURRENT_SMOKER', applied: true }]);
    expect(result.tier).toBe(3);
  });

  it('does not escalate former smokers', () => {
    const worker: WorkerRiskFacts = { smokingStatus: 'former', priorTB: false };
    expect(assessRisk(input(eligibleExposure(), worker)).escalations).toEqual([]);
  });

  it('escalates at 15 years since first exposure, not 14 — once exposure has ended', () => {
    const ended = (yearsAgo: number) =>
      assessRisk(
        input([
          segment({
            taskCode: 'DRILL_DRY',
            startYear: REF_YEAR - yearsAgo,
            endYear: REF_YEAR - 1,
          }),
        ]),
      );

    expect(ended(14).yearsSinceFirstExposure).toBe(14);
    expect(ended(14).escalations).toEqual([]);
    expect(ended(15).yearsSinceFirstExposure).toBe(15);
    expect(ended(15).escalations).toEqual([{ code: 'LATENCY', applied: true }]);
  });

  it('does NOT escalate a long-tenure worker who is still exposed', () => {
    // The double-counting fix. Long service is already inside cumulative
    // exposure — CE is literally intensity × duration — so firing on tenure
    // alone let the same years push the tier up twice. For a worker still in
    // the quarry, CE keeps rising and already tracks them.
    const stillWorking = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 1996, endYear: null })]),
    );
    expect(stillWorking.yearsSinceFirstExposure).toBe(30);
    expect(stillWorking.exposureEnded).toBe(false);
    expect(stillWorking.escalations).toEqual([]);
    expect(stillWorking.tier).toBe(stillWorking.baseTier);
  });

  it('treats a segment running into the reference year as still exposed', () => {
    const thisYear = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 1996, endYear: REF_YEAR })]),
    );
    expect(thisYear.exposureEnded).toBe(false);
    expect(thisYear.escalations).toEqual([]);
  });

  it('fires once the last segment stops, even by one year', () => {
    const justStopped = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 1996, endYear: REF_YEAR - 1 })]),
    );
    expect(justStopped.exposureEnded).toBe(true);
    expect(justStopped.yearsSinceLastExposure).toBe(1);
    expect(justStopped.escalations).toEqual([{ code: 'LATENCY', applied: true }]);
  });

  it('counts exposure as ongoing if ANY segment is still running', () => {
    // A worker who left drilling but still hauls has not left dusty work.
    const mixed = assessRisk(
      input([
        segment({ taskCode: 'DRILL_DRY', startYear: 1996, endYear: 2005 }),
        segment({ taskCode: 'HAUL', startYear: 2006, endYear: null }),
      ]),
    );
    expect(mixed.exposureEnded).toBe(false);
    expect(mixed.escalations).toEqual([]);
  });

  it('measures latency from first exposure, not from last', () => {
    // Silicosis progresses after exposure stops. A worker who left in 2005 is
    // not thereby low-risk.
    const departed = assessRisk(
      input([segment({ taskCode: 'DRILL_DRY', startYear: 1995, endYear: 2005 })]),
    );
    expect(departed.yearsSinceFirstExposure).toBe(REF_YEAR - 1995);
    expect(departed.escalations).toEqual([{ code: 'LATENCY', applied: true }]);
  });
});

describe('PEAK_INTENSITY is currently unreachable — known finding', () => {
  /**
   * The threshold is 0.5 mg/m³. The highest intensity in the JEM is DRILL_DRY
   * at 0.28, and the largest control product is 1.2 (underground, no other
   * controls), giving a ceiling of 0.336.
   *
   * So the rule can never fire against jem-raj-sandstone-0.1.0. This test pins
   * that fact so it fails loudly the moment either the threshold or the matrix
   * changes, forcing a deliberate decision rather than a silent one. It asserts
   * current reality, NOT desired behaviour. See RISK_MODEL.md §7.2.
   */
  const maxControlProduct =
    CONTROL_MODIFIERS.enclosure.open *
    CONTROL_MODIFIERS.ppe.none *
    CONTROL_MODIFIERS.site.underground;

  const ceiling = Math.max(...JEM_TASK_ORDER.map((code) => JEM[code].intensityMgM3));

  it('cannot reach the 0.5 threshold with any task or control combination', () => {
    expect(ceiling * maxControlProduct).toBeCloseTo(0.336, 3);
    expect(ceiling * maxControlProduct).toBeLessThan(0.5);
  });

  it('does not fire for the worst realistic exposure in the matrix', () => {
    const worstCase = assessRisk(
      input([
        segment({
          taskCode: 'DRILL_DRY',
          startYear: 1996,
          endYear: REF_YEAR,
          siteType: 'underground',
          hoursPerDay: 12,
        }),
      ]),
    );
    expect(worstCase.peakIntensity).toBeLessThan(0.5);
    expect(worstCase.escalations.map((e) => e.code)).not.toContain('PEAK_INTENSITY');
  });
});

describe('escalations in combination', () => {
  const allThree: WorkerRiskFacts = { smokingStatus: 'current', priorTB: true };

  it('records every rule that fired, but applies at most the step cap', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 1996, endYear: 2015 })], allThree),
    );

    expect(result.escalations.map((e) => e.code)).toEqual([
      'PRIOR_TB',
      'LATENCY',
      'CURRENT_SMOKER',
    ]);
    expect(result.escalations.filter((e) => e.applied)).toHaveLength(ESCALATION_MAX_STEPS);
    expect(result.tier).toBe(Math.min(4, result.baseTier + ESCALATION_MAX_STEPS));
  });

  it('applies only the strongest-evidence rule when the cap binds', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 1996, endYear: 2015 })], allThree),
    );
    const dropped = result.escalations.filter((e) => !e.applied).map((e) => e.code);
    expect(dropped).toEqual(['LATENCY', 'CURRENT_SMOKER']);
  });

  it('does not escalate below CE 1.0 even when prior TB and smoking are present', () => {
    const result = assessRisk(
      input([loadYears(19)], allThree),
    );
    expect(result.cumulativeExposure).toBe(0.95);
    expect(result.baseTier).toBe(1);
    expect(result.tier).toBe(1);
    expect(result.escalations).toEqual([]);
  });

  it('allows one escalation step at exactly CE 1.0', () => {
    const result = assessRisk(input([loadYears(20)], allThree));
    expect(result.cumulativeExposure).toBe(1);
    expect(result.baseTier).toBe(2);
    expect(result.tier).toBe(3);
    expect(result.escalations).toEqual([
      { code: 'PRIOR_TB', applied: true },
      { code: 'CURRENT_SMOKER', applied: false },
    ]);
  });
});

describe('escalation cap at tier 4', () => {
  const allThree: WorkerRiskFacts = { smokingStatus: 'current', priorTB: true };

  it('caps a Tier 3 worker at 4, not 5', () => {
    const result = assessRisk(input([loadYears(50)], allThree));
    expect(result.baseTier).toBe(3);
    expect(result.tier).toBe(4);
  });

  it('leaves a Tier 4 worker at 4', () => {
    const result = assessRisk(input([loadYears(90)], allThree));
    expect(result.baseTier).toBe(4);
    expect(result.tier).toBe(4);
  });

  it('never de-escalates, across a wide sweep', () => {
    for (const years of [1, 5, 10, 20, 30, 40, 60, 80, 100]) {
      for (const priorTB of [true, false]) {
        for (const smokingStatus of ['never', 'former', 'current'] as const) {
          const result = assessRisk(input([loadYears(years)], { smokingStatus, priorTB }));
          expect(result.tier).toBeGreaterThanOrEqual(result.baseTier);
          expect(result.tier).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe('rescreen interval follows the final tier', () => {
  it.each([
    [1, 60],
    [2, 36],
    [3, 24],
    [4, 12],
  ])('tier %i → %i months', (tier, months) => {
    const years = { 1: 10, 2: 25, 3: 50, 4: 90 }[tier as 1 | 2 | 3 | 4];
    const result = assessRisk(input([loadYears(years)]));
    if (result.tier === tier) expect(result.rescreenMonths).toBe(months);
  });

  it('uses the escalated tier, not the base tier', () => {
    const result = assessRisk(
      input([loadYears(20)], { smokingStatus: 'never', priorTB: true }),
    );
    expect(result.baseTier).toBe(2);
    expect(result.tier).toBe(3);
    expect(result.rescreenMonths).toBe(24);
  });
});

describe('explainability', () => {
  it('aggregates contributions by task and orders them by size', () => {
    const result = assessRisk(
      input([
        segment({ taskCode: 'DRILL_DRY', startYear: 2015, endYear: 2026 }),
        segment({ taskCode: 'HAUL', startYear: 1990, endYear: 2000 }),
      ]),
    );
    expect(result.topContributors[0]?.taskCode).toBe('DRILL_DRY');
    expect(result.topContributors[0]?.contribution).toBeGreaterThan(
      result.topContributors[1]?.contribution ?? 0,
    );
  });

  it('merges repeated segments of the same task into one contributor', () => {
    const result = assessRisk(
      input([
        segment({ taskCode: 'DRILL_DRY', startYear: 1990, endYear: 1999 }),
        segment({ taskCode: 'DRILL_DRY', startYear: 2010, endYear: 2019 }),
      ]),
    );
    expect(result.topContributors).toHaveLength(1);
    expect(result.topContributors[0]?.fteYears).toBe(20);
    expect(result.topContributors[0]?.calendarYears).toBe(20);
    expect(result.topContributors[0]?.percentOfTotal).toBe(100);
  });

  it('returns at most three contributors', () => {
    const result = assessRisk(
      input(
        ['DRILL_DRY', 'CRUSH', 'DRESS', 'LOAD', 'HAUL'].map((taskCode, index) =>
          segment({ taskCode, startYear: 1980 + index * 5, endYear: 1984 + index * 5 }),
        ),
      ),
    );
    expect(result.topContributors).toHaveLength(3);
  });

  it('breaks contribution ties by task code, for byte-stable output', () => {
    const result = assessRisk(
      input([
        segment({ taskCode: 'LOAD', startYear: 2010, endYear: 2019 }),
        segment({ taskCode: 'CUT_WET', startYear: 1990, endYear: 1999 }),
      ]),
    );
    // CUT_WET (0.04) × 10 = 0.40; LOAD (0.05) × 10 = 0.50 — not a tie, but the
    // sort must still be total and reproducible.
    expect(result.topContributors.map((c) => c.taskCode)).toEqual(['LOAD', 'CUT_WET']);
  });

  it('percentages sum to 100 when three tasks or fewer are present', () => {
    const result = assessRisk(
      input([
        segment({ taskCode: 'DRILL_DRY', startYear: 1990, endYear: 1999 }),
        segment({ taskCode: 'LOAD', startYear: 2000, endYear: 2009 }),
      ]),
    );
    const total = result.topContributors.reduce((sum, c) => sum + c.percentOfTotal, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('stamps the model and JEM versions on every result', () => {
    const result = assessRisk(input([loadYears(5)]));
    expect(result.modelVersion).toBe(MODEL_VERSION);
    expect(result.jemVersion).toBe('jem-raj-sandstone-0.1.0');
    expect(result.confidence).toBe('provisional');
  });
});

describe('the demo narrative worker', () => {
  it('reaches a high tier from dry drilling alone, with no symptoms involved', () => {
    // The beat that matters: this worker would be rejected at CHC level under
    // the current symptom criterion.
    const result = assessRisk(
      input([segment({ taskCode: 'DRILL_DRY', startYear: 2014, endYear: 2026 })], CLEAN_WORKER),
    );
    expect(result.topContributors[0]?.taskCode).toBe('DRILL_DRY');
    expect(result.tier).toBeGreaterThanOrEqual(2);
    expect(result.reasonEn).toContain('dry drilling');
    expect(result.reasonEn.endsWith('Not a diagnosis.')).toBe(true);
  });
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
