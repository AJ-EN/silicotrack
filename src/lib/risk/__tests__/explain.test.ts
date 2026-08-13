import { describe, expect, it } from 'vitest';

import { assessRisk } from '../engine';
import {
  NOT_A_DIAGNOSIS_EN,
  NOT_A_DIAGNOSIS_HI,
  PROVISIONAL_NOTICE_EN,
  PROVISIONAL_NOTICE_HI,
  buildReason,
  escalationLabelEn,
  escalationLabelHi,
  tierLabelEn,
  tierLabelHi,
} from '../explain';
import { CLEAN_WORKER, REF_YEAR, input, segment } from './helpers';
import type { EscalationCode, Tier } from '../types';

const TIERS: Tier[] = [1, 2, 3, 4];
const CODES: EscalationCode[] = ['PRIOR_TB', 'LATENCY', 'CURRENT_SMOKER'];

describe('the non-diagnosis statement is non-negotiable', () => {
  it('terminates every generated reason, in both languages', () => {
    const cases = [
      assessRisk(input([])),
      assessRisk(input([segment({ taskCode: 'LOAD', startYear: 2024 })])),
      assessRisk(
        input([segment({ taskCode: 'DRILL_DRY', startYear: 1990, endYear: 2026 })], {
          smokingStatus: 'current',
          priorTB: true,
        }),
      ),
    ];

    for (const result of cases) {
      expect(result.reasonEn.endsWith(NOT_A_DIAGNOSIS_EN)).toBe(true);
      expect(result.reasonHi.endsWith(NOT_A_DIAGNOSIS_HI)).toBe(true);
    }
  });

  it('never emits a word that could read as a diagnosis', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'DRILL_DRY', startYear: 1990, endYear: 2026 })], {
        smokingStatus: 'current',
        priorTB: true,
      }),
    );
    const forbidden = /silicosis|diagnos(is|ed)|positive|disease|likely|probability/i;
    // "Not a diagnosis." is the only permitted use of the root.
    const withoutDisclaimer = result.reasonEn.replace(NOT_A_DIAGNOSIS_EN, '');
    expect(withoutDisclaimer).not.toMatch(forbidden);
  });
});

describe('labels', () => {
  it('covers every tier in both languages', () => {
    for (const tier of TIERS) {
      expect(tierLabelEn(tier).length).toBeGreaterThan(0);
      expect(tierLabelHi(tier)).toMatch(/[ऀ-ॿ]/);
    }
  });

  it('covers every escalation code in both languages', () => {
    for (const code of CODES) {
      expect(escalationLabelEn(code).length).toBeGreaterThan(0);
      expect(escalationLabelHi(code)).toMatch(/[ऀ-ॿ]/);
    }
  });

  it('renders Devanagari for the persistent provisional notice', () => {
    expect(PROVISIONAL_NOTICE_EN).toContain('provisional');
    expect(PROVISIONAL_NOTICE_EN).toContain('District Pneumoconiosis Board');
    expect(PROVISIONAL_NOTICE_HI).toMatch(/[ऀ-ॿ]/);
  });
});

describe('reason content', () => {
  it('names the dominant task, its years, and its share', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'DRILL_DRY', startYear: 2015, endYear: REF_YEAR })]),
    );
    expect(result.reasonEn).toContain('dry drilling');
    expect(result.reasonEn).toContain('12 years');
    expect(result.reasonEn).toContain('100.0%');
    expect(result.reasonHi).toContain('सूखी ड्रिलिंग');
  });

  it('renders whole years without a decimal point', () => {
    const reason = buildReason({
      tier: 2,
      cumulativeExposure: 1.5,
      topContributors: [
        {
          taskCode: 'DRILL_DRY',
          contribution: 1.5,
          percentOfTotal: 100,
          fteYears: 18,
          calendarYears: 12,
        },
      ],
      escalations: [],
      insufficientData: false,
    });
    expect(reason.en).toContain('12 years');
    expect(reason.en).not.toContain('12.0 years');
  });

  it('reports calendar years, never the FTE years the model multiplies', () => {
    const reason = buildReason({
      tier: 1,
      cumulativeExposure: 0.4,
      topContributors: [
        {
          taskCode: 'LOAD',
          contribution: 0.4,
          percentOfTotal: 100,
          fteYears: 7.5,
          calendarYears: 8,
        },
      ],
      escalations: [],
      insufficientData: false,
    });
    // 7.5 FTE years of 12-hour days across 8 calendar years. Printing 7.5 to
    // someone holding the worker's file would read as an error.
    expect(reason.en).toContain('8 years');
    expect(reason.en).not.toContain('7.5');
  });

  it('always shows cumulative exposure to two decimal places', () => {
    const reason = buildReason({
      tier: 4,
      cumulativeExposure: 4,
      topContributors: [],
      escalations: [],
      insufficientData: false,
    });
    expect(reason.en).toContain('4.00 mg/m³·years');
  });

  it('names only escalations that actually moved the tier', () => {
    // Rules dropped by the step cap stay in the detail panel; naming them here
    // would imply they changed the result when they did not.
    const reason = buildReason({
      tier: 3,
      cumulativeExposure: 1.2,
      topContributors: [],
      escalations: [
        { code: 'PRIOR_TB', applied: true },
        { code: 'LATENCY', applied: true },
        { code: 'CURRENT_SMOKER', applied: false },
      ],
      insufficientData: false,
    });
    expect(reason.en).toContain('prior TB');
    // States BOTH halves of the rule: the tenure interval AND that exposure
    // has stopped. The old tenure-only wording would now describe workers the
    // rule no longer fires for.
    expect(reason.en).toContain('exposure ended, 15+ years since it began');
    expect(reason.en).not.toContain('current smoker');
    expect(reason.hi).not.toContain('वर्तमान धूम्रपान');
  });

  it('omits the escalation clause entirely when nothing fired', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'LOAD', startYear: 2024 })], CLEAN_WORKER),
    );
    expect(result.reasonEn).not.toContain('Escalated');
    expect(result.reasonHi).not.toContain('श्रेणी बढ़ाई गई');
  });

  it('reports an incomplete interview rather than implying low risk', () => {
    const reason = buildReason({
      tier: 1,
      cumulativeExposure: 0,
      topContributors: [],
      escalations: [],
      insufficientData: true,
    });
    expect(reason.en).toContain('Interview incomplete');
    expect(reason.en).not.toContain('Low —');
    expect(reason.hi).toContain('साक्षात्कार अधूरा');
  });
});

describe('formatting is locale-independent', () => {
  it('uses Latin digits in the Hindi string, as Indian health forms do', () => {
    const result = assessRisk(
      input([segment({ taskCode: 'DRILL_DRY', startYear: 2015, endYear: REF_YEAR })]),
    );
    expect(result.reasonHi).toMatch(/\d/);
    // No Devanagari digits (U+0966–U+096F), which would break at a glance for
    // a reader used to government forms.
    expect(result.reasonHi).not.toMatch(/[०-९]/);
  });
});
