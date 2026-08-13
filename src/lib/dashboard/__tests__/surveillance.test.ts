import { describe, expect, it } from 'vitest';

import {
  STATE_PUBLISHED_REJECTION_RATE,
  buildSurveillance,
  isAbnormalIloRead,
  isFlaggedRead,
  type SurveillanceInput,
} from '../surveillance';
import type { Tier } from '@/lib/risk/types';

function input(overrides: Partial<SurveillanceInput> = {}): SurveillanceInput {
  return {
    workers: [],
    invites: [],
    screenings: [],
    referrals: [],
    ...overrides,
  };
}

function worker(id: string, tier: Tier | null, district = 'Karauli') {
  return { workerId: id, district, tier, insufficientData: tier === null };
}

describe('ILO reading', () => {
  it('reads the MAJOR category, not the minor one', () => {
    // "1/0" is category 1 with 0 considered — positive.
    // "0/1" is category 0 with 1 considered — not.
    expect(isAbnormalIloRead('1/0')).toBe(true);
    expect(isAbnormalIloRead('0/1')).toBe(false);
  });

  it('treats every category at or above 1 as positive', () => {
    for (const read of ['1/0', '1/1', '1/2', '2/1', '2/2', '3/3']) {
      expect(isAbnormalIloRead(read)).toBe(true);
    }
    expect(isAbnormalIloRead('0/0')).toBe(false);
  });

  it('treats an unread film as not-positive rather than throwing', () => {
    // Unread is not the same as negative, but it cannot be counted as a
    // finding either. The cohort counts show the gap.
    expect(isAbnormalIloRead(null)).toBe(false);
    expect(isAbnormalIloRead('')).toBe(false);
    expect(isAbnormalIloRead('nonsense')).toBe(false);
  });
});

describe('cohort counts', () => {
  it('separates registered, assessed and incomplete', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 2), worker('B', 3), worker('C', null)],
      }),
    );
    expect(result.cohort.registered).toBe(3);
    expect(result.cohort.assessed).toBe(2);
    expect(result.cohort.incomplete).toBe(1);
  });

  it('counts a worker invited to several camps once', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4)],
        invites: [
          { workerId: 'A', attended: false },
          { workerId: 'A', attended: true },
        ],
      }),
    );
    expect(result.cohort.invited).toBe(1);
    expect(result.cohort.attended).toBe(1);
  });

  it('counts abnormal findings by radiologist read, not by field outcome', () => {
    // The radiologist is the authority. A field outcome of ABNORMAL with a
    // category-0 read is not a finding.
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 3)],
        screenings: [
          { workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '0/1' },
          { workerId: 'B', outcome: 'NORMAL', radiologistRead: '1/1' },
        ],
      }),
    );
    expect(result.cohort.abnormal).toBe(1);
  });

  it('counts disbursed workers as certified', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 4)],
        referrals: [
          { workerId: 'A', status: 'CERTIFIED' },
          { workerId: 'B', status: 'DISBURSED' },
        ],
      }),
    );
    expect(result.cohort.certified).toBe(2);
  });
});

describe('the cascade must not widen', () => {
  /**
   * A detection cascade that goes UP at a step is either a bug or a lie. The
   * first version counted only ILO 1+ at the findings step while referrals
   * also came from borderline 0/1 films, so the chart showed 51 findings
   * feeding 61 referrals.
   */
  it('counts borderline 0/1 films as flagged, not as findings', () => {
    expect(isFlaggedRead('0/1')).toBe(true);
    expect(isAbnormalIloRead('0/1')).toBe(false);
    expect(isFlaggedRead('0/0')).toBe(false);
    expect(isFlaggedRead(null)).toBe(false);
  });

  it('never reports fewer flagged than abnormal', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 3), worker('C', 2)],
        screenings: [
          { workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '1/1' },
          { workerId: 'B', outcome: 'INCONCLUSIVE', radiologistRead: '0/1' },
          { workerId: 'C', outcome: 'NORMAL', radiologistRead: '0/0' },
        ],
      }),
    );
    expect(result.cohort.abnormal).toBe(1);
    expect(result.cohort.flaggedForReview).toBe(2);
    expect(result.cohort.flaggedForReview).toBeGreaterThanOrEqual(result.cohort.abnormal);
  });

  it('keeps the flagged step at least as large as the referred step', () => {
    // The property that makes the cascade honest: everyone referred was
    // flagged first.
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 3)],
        screenings: [
          { workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '2/1' },
          { workerId: 'B', outcome: 'INCONCLUSIVE', radiologistRead: '0/1' },
        ],
        referrals: [
          { workerId: 'A', status: 'BOARD' },
          { workerId: 'B', status: 'RADIOLOGIST' },
        ],
      }),
    );
    expect(result.cohort.flaggedForReview).toBeGreaterThanOrEqual(result.cohort.referred);
  });
});

describe('tier distribution', () => {
  it('reports all four tiers with shares', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 1), worker('B', 1), worker('C', 3), worker('D', 4)],
      }),
    );
    expect(result.tiers.map((t) => t.count)).toEqual([2, 0, 1, 1]);
    expect(result.tiers[0]?.share).toBe(50);
  });

  it('lists a tier at zero rather than omitting it', () => {
    const result = buildSurveillance(input({ workers: [worker('A', 1)] }));
    expect(result.tiers).toHaveLength(4);
  });
});

describe('district rollup', () => {
  it('splits the cohort by district', () => {
    const result = buildSurveillance(
      input({
        workers: [
          worker('A', 4, 'Karauli'),
          worker('B', 1, 'Karauli'),
          worker('C', 4, 'Jodhpur'),
        ],
        invites: [{ workerId: 'A', attended: true }],
        screenings: [{ workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '2/2' }],
        referrals: [{ workerId: 'A', status: 'CERTIFIED' }],
      }),
    );

    const karauli = result.districts.find((d) => d.district === 'Karauli');
    expect(karauli).toMatchObject({
      workers: 2,
      priority: 1,
      priorityShare: 50,
      attended: 1,
      abnormal: 1,
      certified: 1,
    });

    const jodhpur = result.districts.find((d) => d.district === 'Jodhpur');
    expect(jodhpur).toMatchObject({ workers: 1, attended: 0, abnormal: 0 });
  });
});

describe('symptom gate — the headline', () => {
  /**
   * The system never asks about symptoms. The asymptomatic determination is
   * the STATE's own, recorded at CHC as the rejection reason, so this measures
   * their criterion against their own assessment.
   */
  it('counts workers with findings who were rejected for having no symptoms', () => {
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 3), worker('C', 2)],
        screenings: [
          { workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '1/1' },
          { workerId: 'B', outcome: 'ABNORMAL', radiologistRead: '2/1' },
          { workerId: 'C', outcome: 'ABNORMAL', radiologistRead: '1/0' },
        ],
        referrals: [
          { workerId: 'A', status: 'REJECTED_NO_SYMPTOMS' },
          { workerId: 'B', status: 'CERTIFIED' },
          { workerId: 'C', status: 'REJECTED_NO_SYMPTOMS' },
        ],
      }),
    );

    expect(result.symptomGate.abnormalFindings).toBe(3);
    expect(result.symptomGate.discardedAtSymptomGate).toBe(2);
    expect(result.symptomGate.discardRate).toBeCloseTo(66.7, 1);
  });

  it('reports how many of the discarded were already high exposure tier', () => {
    // A tier-4 worker with a category-2 film, rejected for lacking symptoms,
    // is the single clearest illustration of the criterion failing.
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4), worker('B', 1)],
        screenings: [
          { workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '2/2' },
          { workerId: 'B', outcome: 'ABNORMAL', radiologistRead: '1/0' },
        ],
        referrals: [
          { workerId: 'A', status: 'REJECTED_NO_SYMPTOMS' },
          { workerId: 'B', status: 'REJECTED_NO_SYMPTOMS' },
        ],
      }),
    );
    expect(result.symptomGate.discardedAtSymptomGate).toBe(2);
    expect(result.symptomGate.discardedAtHighTier).toBe(1);
  });

  it('ignores rejections that were made on radiological grounds', () => {
    // REJECTED_POST_XRAY is a different decision entirely — the film was read
    // and found below threshold. Counting it here would misattribute a
    // radiological judgement to the symptom criterion.
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4)],
        screenings: [{ workerId: 'A', outcome: 'ABNORMAL', radiologistRead: '1/1' }],
        referrals: [{ workerId: 'A', status: 'REJECTED_POST_XRAY' }],
      }),
    );
    expect(result.symptomGate.discardedAtSymptomGate).toBe(0);
  });

  it('does not count a symptom rejection without a positive film', () => {
    // The claim is specifically about workers who HAD findings. A rejection
    // with a clean film proves nothing about the criterion.
    const result = buildSurveillance(
      input({
        workers: [worker('A', 4)],
        screenings: [{ workerId: 'A', outcome: 'NORMAL', radiologistRead: '0/0' }],
        referrals: [{ workerId: 'A', status: 'REJECTED_NO_SYMPTOMS' }],
      }),
    );
    expect(result.symptomGate.abnormalFindings).toBe(0);
    expect(result.symptomGate.discardedAtSymptomGate).toBe(0);
    expect(result.symptomGate.discardRate).toBe(0);
  });

  it('carries the state published rate for comparison', () => {
    const result = buildSurveillance(input());
    expect(result.symptomGate.statePublishedRejectionRate).toBe(
      STATE_PUBLISHED_REJECTION_RATE,
    );
    expect(STATE_PUBLISHED_REJECTION_RATE).toBe(57.6);
  });
});

describe('degenerate input', () => {
  it('handles an empty cohort without dividing by zero', () => {
    const result = buildSurveillance(input());
    expect(result.cohort.registered).toBe(0);
    expect(result.tiers.every((t) => t.share === 0)).toBe(true);
    expect(result.symptomGate.discardRate).toBe(0);
    expect(result.districts).toEqual([]);
  });

  it('is deterministic', () => {
    const pool = input({
      workers: [worker('A', 4), worker('B', 2, 'Jodhpur')],
      referrals: [{ workerId: 'A', status: 'CERTIFIED' }],
    });
    expect(buildSurveillance(pool)).toEqual(buildSurveillance(pool));
  });
});
