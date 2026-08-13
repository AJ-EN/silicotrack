import { describe, expect, it } from 'vitest';

import { assessRisk } from '../engine';
import { GOLDEN_PROFILES, GOLDEN_REFERENCE_DATE } from './golden-profiles';
import golden from './golden.json';
import type { RiskResult, Tier } from '../types';

interface GoldenRow {
  id: string;
  description: string;
  result: RiskResult;
}

const rows = golden as unknown as GoldenRow[];

/**
 * The golden file is the model's memory.
 *
 * Any change to the engine, the JEM, the control modifiers, the thresholds or
 * the reason strings that alters these twenty outputs will fail here. That is
 * the point: model drift becomes visible instead of silent.
 *
 * When a diff is intentional: `npm run test:golden:update`, then review the
 * diff line by line and explain it in the commit message. An unexplained
 * golden diff is a defect, not a test update.
 */
describe('golden file', () => {
  it('covers exactly the twenty committed profiles', () => {
    expect(rows).toHaveLength(20);
    expect(GOLDEN_PROFILES).toHaveLength(20);
    expect(rows.map((row) => row.id)).toEqual(GOLDEN_PROFILES.map((p) => p.id));
  });

  it.each(GOLDEN_PROFILES.map((p, i) => [p.id, p.description, i] as const))(
    '%s — %s',
    (_id, _description, index) => {
      const profile = GOLDEN_PROFILES[index];
      const expected = rows[index];
      expect(profile).toBeDefined();
      expect(expected).toBeDefined();
      expect(assessRisk(profile.input)).toEqual(expected.result);
    },
  );

  it('pins the reference date, so the fixture never depends on the clock', () => {
    expect(GOLDEN_REFERENCE_DATE).toBe('2026-08-13');
    for (const profile of GOLDEN_PROFILES) {
      expect(profile.input.referenceDate).toBe(GOLDEN_REFERENCE_DATE);
    }
  });
});

/**
 * Coverage assertions over the fixture itself. A golden file that quietly
 * stopped exercising tier 4, or escalations, or the incomplete-interview path,
 * would still pass every equality check above while testing nothing.
 */
describe('golden file exercises the whole model', () => {
  const results = rows.map((row) => row.result);

  it('spans all four tiers', () => {
    const tiers = new Set<Tier>(results.map((r) => r.tier));
    expect([...tiers].sort()).toEqual([1, 2, 3, 4]);
  });

  it('includes workers whose tier was raised by escalation', () => {
    expect(results.some((r) => r.tier > r.baseTier)).toBe(true);
  });

  it('includes a worker where the escalation step cap binds', () => {
    const capped = results.find((r) => r.escalations.some((e) => !e.applied));
    expect(capped).toBeDefined();
    expect(capped?.escalations.filter((e) => e.applied)).toHaveLength(2);
  });

  it('includes an incomplete interview', () => {
    expect(results.some((r) => r.insufficientData)).toBe(true);
  });

  it('exercises every escalation rule that can currently fire', () => {
    const fired = new Set(results.flatMap((r) => r.escalations.map((e) => e.code)));
    expect(fired).toEqual(new Set(['PRIOR_TB', 'LATENCY', 'CURRENT_SMOKER']));
  });

  it('confirms PEAK_INTENSITY never fires across any realistic profile', () => {
    // Not desired behaviour — a documented dead rule. The 0.5 threshold sits
    // above the matrix ceiling of 0.336. See RISK_MODEL.md §7.2.
    const peaks = results.map((r) => r.peakIntensity);
    expect(Math.max(...peaks)).toBeLessThan(0.5);
    expect(results.every((r) => !r.escalations.some((e) => e.code === 'PEAK_INTENSITY'))).toBe(
      true,
    );
  });

  it('never de-escalates any profile', () => {
    for (const result of results) {
      expect(result.tier).toBeGreaterThanOrEqual(result.baseTier);
    }
  });

  it('stamps a provisional confidence and both versions on every profile', () => {
    for (const result of results) {
      expect(result.confidence).toBe('provisional');
      expect(result.modelVersion).toBe('risk-model-0.1.0');
      expect(result.jemVersion).toBe('jem-raj-sandstone-0.1.0');
    }
  });

  it('never reports an implausible working life in a reason string', () => {
    // Regression guard. The reason string once printed FTE years — which carry
    // the 12-hour-day multiplier — as though they were calendar years, and a
    // seeded worker came out as "67.5 years of polishing". Arithmetically
    // correct, and instantly disqualifying to anyone holding the man's file.
    for (const result of results) {
      const match = /mainly ([\d.]+) years/.exec(result.reasonEn);
      if (match?.[1] === undefined) continue;
      const years = Number(match[1]);
      expect(Number.isInteger(years)).toBe(true);
      expect(years).toBeGreaterThan(0);
      expect(years).toBeLessThanOrEqual(60);
      // TSFE counts years ELAPSED since first exposure; calendarYears counts
      // years WORKED, with the start year inclusive. Someone who started in
      // 2024 has worked 2024/2025/2026 — three years — but only two have
      // elapsed. The two differ by exactly one, and never by more.
      expect(years).toBeLessThanOrEqual(result.yearsSinceFirstExposure + 1);
    }
  });

  it('keeps FTE years and calendar years distinct on every contributor', () => {
    for (const result of results) {
      for (const contributor of result.topContributors) {
        expect(contributor.calendarYears).toBeGreaterThan(0);
        expect(Number.isInteger(contributor.calendarYears)).toBe(true);
        // FTE can exceed calendar (long days) or fall below it (part-year), but
        // never by more than the 12-hour clamp allows.
        expect(contributor.fteYears).toBeLessThanOrEqual(contributor.calendarYears * 1.5);
      }
    }
  });

  it('ends every reason string with the non-diagnosis statement', () => {
    for (const result of results) {
      expect(result.reasonEn.endsWith('Not a diagnosis.')).toBe(true);
      expect(result.reasonHi.endsWith('यह निदान नहीं है।')).toBe(true);
    }
  });
});
