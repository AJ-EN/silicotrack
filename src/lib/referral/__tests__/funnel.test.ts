import { describe, expect, it } from 'vitest';

import { buildFunnel, type ReferralRecord, type StageEventRecord } from '../funnel';
import {
  PIPELINE_STAGES,
  STALLED_DAYS,
  isCertifiedOutcome,
  isPaymentGap,
  isPipelineComplete,
  isStalled,
  isTerminalStage,
  stageIndex,
} from '../stages';

let serial = 0;

/** A referral that walked the pipeline up to `through`, then optionally exited. */
function referral(options: {
  through: number;
  terminal?: string;
  daysInStage?: number;
  gap?: number;
}): ReferralRecord {
  serial += 1;
  const gap = options.gap ?? 5;
  const stageHistory: StageEventRecord[] = [];

  for (let index = 0; index <= options.through; index++) {
    const stage = PIPELINE_STAGES[index];
    if (stage === undefined) break;
    stageHistory.push({
      stage,
      // Fixed base date — the funnel must never read a clock.
      enteredAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      daysInPreviousStage: index === 0 ? null : gap,
    });
  }

  if (options.terminal !== undefined) {
    stageHistory.push({
      stage: options.terminal,
      enteredAt: `2026-02-${String(options.through + 1).padStart(2, '0')}T00:00:00Z`,
      daysInPreviousStage: gap,
    });
  }

  const last = stageHistory[stageHistory.length - 1];
  return {
    id: `REF-${String(serial).padStart(4, '0')}`,
    status: options.terminal ?? last?.stage ?? 'REGISTERED',
    daysInStage: options.daysInStage ?? 3,
    stageHistory,
  };
}

describe('stage vocabulary matches the state portal', () => {
  it('lists the eight pipeline stages in order', () => {
    expect(PIPELINE_STAGES).toEqual([
      'REGISTERED',
      'PRIMARY_CHECKUP',
      'RADIOGRAPHER',
      'RADIOLOGIST',
      'MO_APPROVAL',
      'BOARD',
      'CERTIFIED',
      'DISBURSED',
    ]);
  });

  it('treats terminal states as outside the pipeline', () => {
    expect(stageIndex('REJECTED_NO_SYMPTOMS')).toBe(-1);
    expect(isTerminalStage('REJECTED_NO_SYMPTOMS')).toBe(true);
    expect(isTerminalStage('BOARD')).toBe(false);
  });

  it('counts disbursement as a certified outcome, not a separate one', () => {
    // Disbursement is a payment step after certification, not a clinical result.
    expect(isCertifiedOutcome('CERTIFIED')).toBe(true);
    expect(isCertifiedOutcome('DISBURSED')).toBe(true);
    expect(isCertifiedOutcome('BOARD')).toBe(false);
  });
});

describe('stall detection', () => {
  it('flags a referral past the threshold', () => {
    expect(isStalled('RADIOLOGIST', STALLED_DAYS + 1)).toBe(true);
    expect(isStalled('RADIOLOGIST', STALLED_DAYS)).toBe(false);
  });

  it('never flags a terminal referral', () => {
    // A rejected or lost referral is finished, not stalled. Counting it would
    // bury the referrals a coordinator can still rescue.
    expect(isStalled('REJECTED_NO_SYMPTOMS', 900)).toBe(false);
    expect(isStalled('LOST_TO_FOLLOWUP', 900)).toBe(false);
  });

  it('never flags a DISBURSED referral', () => {
    // Certified and paid. Nothing follows it, so eighty days there is
    // completion, not delay. This was wrong on the first pass: every disbursed
    // referral in the seed showed up on the coordinator's worklist.
    expect(isPipelineComplete('DISBURSED')).toBe(true);
    expect(isStalled('DISBURSED', 900)).toBe(false);
  });

  it('DOES flag a certified referral still waiting to be paid', () => {
    // A worker certified months ago and still unpaid is a real, actionable
    // failure — the compensation delay the state is criticised for. Hiding it
    // would be as dishonest as flagging the disbursed ones.
    expect(isPipelineComplete('CERTIFIED')).toBe(false);
    expect(isStalled('CERTIFIED', 60)).toBe(true);
  });
});

describe('detection attrition is separated from payment delay', () => {
  it('labels the CERTIFIED gap as awaiting payment, not drop-off', () => {
    // Those workers WERE found. Counting them as lost would overstate
    // detection failure and bury a payment failure inside it.
    const funnel = buildFunnel([
      referral({ through: 6 }),
      referral({ through: 6 }),
      referral({ through: 7 }),
    ]);

    const certified = funnel.stages.find((s) => s.stage === 'CERTIFIED');
    expect(certified?.lossKind).toBe('awaiting_payment');
    expect(certified?.lost).toBe(2);
    expect(funnel.awaitingPayment).toBe(2);
  });

  it('labels every pre-certification gap as attrition', () => {
    const funnel = buildFunnel([referral({ through: 7 })]);
    for (const stage of funnel.stages) {
      if (stage.stage === 'CERTIFIED') continue;
      expect(stage.lossKind).toBe('attrition');
    }
  });

  it('keeps a payment backlog out of the headline drop-off', () => {
    // 20 certified and unpaid must NOT present itself as the pipeline's worst
    // leak — that would point a coordinator at the wrong problem entirely.
    const funnel = buildFunnel([
      ...Array.from({ length: 20 }, () => referral({ through: 6 })),
      ...Array.from({ length: 3 }, () => referral({ through: 1 })),
    ]);

    expect(funnel.awaitingPayment).toBe(20);
    expect(funnel.biggestLoss?.stage).toBe('PRIMARY_CHECKUP');
    expect(funnel.biggestLoss?.lost).toBe(3);
  });

  it('marks only CERTIFIED as the payment gap', () => {
    expect(isPaymentGap('CERTIFIED')).toBe(true);
    expect(isPaymentGap('BOARD')).toBe(false);
    expect(isPaymentGap('DISBURSED')).toBe(false);
  });
});

describe('funnel counts reached, not current', () => {
  it('counts a referral at every stage it passed through', () => {
    // "How many are sitting at RADIOLOGIST" describes a queue. "How many ever
    // reached RADIOLOGIST" describes a pipeline.
    const funnel = buildFunnel([referral({ through: 3 })]);

    expect(funnel.stages[0]?.reached).toBe(1);
    expect(funnel.stages[3]?.reached).toBe(1);
    expect(funnel.stages[4]?.reached).toBe(0);
    expect(funnel.stages[3]?.current).toBe(1);
    expect(funnel.stages[0]?.current).toBe(0);
  });

  it('counts a repeated stage only once', () => {
    // A record bounced back for correction must not inflate the funnel.
    const bounced = referral({ through: 2 });
    bounced.stageHistory = [
      ...bounced.stageHistory,
      {
        stage: 'PRIMARY_CHECKUP',
        enteredAt: '2026-03-01T00:00:00Z',
        daysInPreviousStage: 4,
      },
    ];
    const funnel = buildFunnel([bounced]);
    expect(funnel.stages[1]?.reached).toBe(1);
  });

  it('computes loss as the gap between consecutive stages', () => {
    const funnel = buildFunnel([
      referral({ through: 7 }),
      referral({ through: 1 }),
      referral({ through: 1 }),
    ]);

    expect(funnel.stages[0]?.reached).toBe(3);
    expect(funnel.stages[1]?.reached).toBe(3);
    expect(funnel.stages[2]?.reached).toBe(1);
    // Two of three were lost between PRIMARY_CHECKUP and RADIOGRAPHER.
    expect(funnel.stages[1]?.lost).toBe(2);
    expect(funnel.stages[1]?.lostShare).toBeCloseTo(66.7, 1);
  });

  it('reports no loss at the final stage rather than a negative one', () => {
    const funnel = buildFunnel([referral({ through: 7 })]);
    expect(funnel.stages[7]?.lost).toBe(0);
  });

  it('identifies the single worst leak', () => {
    const funnel = buildFunnel([
      ...Array.from({ length: 10 }, () => referral({ through: 1 })),
      referral({ through: 7 }),
    ]);
    expect(funnel.biggestLoss?.stage).toBe('PRIMARY_CHECKUP');
    expect(funnel.biggestLoss?.lost).toBe(10);
  });

  it('returns a null headline when nothing was lost', () => {
    const funnel = buildFunnel([referral({ through: 7 })]);
    expect(funnel.biggestLoss).toBeNull();
  });
});

describe('terminal outcomes', () => {
  it('records where each rejection happened', () => {
    const funnel = buildFunnel([
      referral({ through: 1, terminal: 'REJECTED_NO_SYMPTOMS' }),
      referral({ through: 1, terminal: 'REJECTED_NO_SYMPTOMS' }),
      referral({ through: 3, terminal: 'REJECTED_POST_XRAY' }),
    ]);

    const noSymptoms = funnel.terminal.find((t) => t.stage === 'REJECTED_NO_SYMPTOMS');
    expect(noSymptoms?.count).toBe(2);
    // Rejected at CHC level — the state's largest bucket, 57.6% of applications.
    expect(noSymptoms?.lostFrom[0]).toEqual({ stage: 'PRIMARY_CHECKUP', count: 2 });

    const postXray = funnel.terminal.find((t) => t.stage === 'REJECTED_POST_XRAY');
    expect(postXray?.lostFrom[0]).toEqual({ stage: 'RADIOLOGIST', count: 1 });
  });

  it('orders outcomes by size so the biggest bucket leads', () => {
    const funnel = buildFunnel([
      ...Array.from({ length: 5 }, () => referral({ through: 1, terminal: 'REJECTED_NO_SYMPTOMS' })),
      referral({ through: 2, terminal: 'LOST_TO_FOLLOWUP' }),
    ]);
    expect(funnel.terminal[0]?.stage).toBe('REJECTED_NO_SYMPTOMS');
    expect(funnel.terminal[0]?.share).toBeCloseTo(83.3, 1);
  });

  it('lists every terminal state even at zero, so absence is visible', () => {
    const funnel = buildFunnel([referral({ through: 7 })]);
    expect(funnel.terminal).toHaveLength(3);
    expect(funnel.terminal.every((t) => t.count === 0)).toBe(true);
  });
});

describe('stalled referrals', () => {
  it('counts them per stage and in total', () => {
    const funnel = buildFunnel([
      referral({ through: 3, daysInStage: 40 }),
      referral({ through: 3, daysInStage: 2 }),
      referral({ through: 5, daysInStage: 21 }),
    ]);

    expect(funnel.stalledTotal).toBe(2);
    expect(funnel.stages[3]?.stalled).toBe(1);
    expect(funnel.stages[5]?.stalled).toBe(1);
  });

  it('excludes terminal referrals however long they have sat', () => {
    const funnel = buildFunnel([
      referral({ through: 1, terminal: 'REJECTED_NO_SYMPTOMS', daysInStage: 500 }),
    ]);
    expect(funnel.stalledTotal).toBe(0);
  });
});

describe('median time in stage', () => {
  it('reads durations pairwise from consecutive transitions', () => {
    const funnel = buildFunnel([
      referral({ through: 4, gap: 10 }),
      referral({ through: 4, gap: 20 }),
    ]);
    expect(funnel.stages[0]?.medianDays).toBe(15);
  });

  it('is null where nobody has moved on yet', () => {
    const funnel = buildFunnel([referral({ through: 0 })]);
    expect(funnel.stages[0]?.medianDays).toBeNull();
  });
});

describe('summary counts', () => {
  it('separates certified, in progress and terminal', () => {
    const funnel = buildFunnel([
      referral({ through: 7 }),
      referral({ through: 6 }),
      referral({ through: 3 }),
      referral({ through: 1, terminal: 'REJECTED_NO_SYMPTOMS' }),
    ]);

    expect(funnel.total).toBe(4);
    expect(funnel.certifiedTotal).toBe(2);
    expect(funnel.inProgress).toBe(1);
  });

  it('handles an empty pipeline without dividing by zero', () => {
    const funnel = buildFunnel([]);
    expect(funnel.total).toBe(0);
    expect(funnel.biggestLoss).toBeNull();
    expect(funnel.stages.every((s) => s.reachedShare === 0)).toBe(true);
  });

  it('is deterministic and reads no clock', () => {
    const pool = [referral({ through: 3 }), referral({ through: 1, terminal: 'LOST_TO_FOLLOWUP' })];
    expect(buildFunnel(pool)).toEqual(buildFunnel(pool));
  });
});
