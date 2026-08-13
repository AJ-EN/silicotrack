import { describe, expect, it } from 'vitest';

import {
  ANCHOR_TARGET_MG_M3,
  ANCHOR_TOLERANCE_MG_M3,
  JEM,
  JEM_TASK_ORDER,
  JEM_VERSION,
  MINE_TASK_MIX,
  getJemEntry,
  isJemTaskCode,
  resolveTaskCode,
  weightedMeanIntensity,
} from '../jem';

describe('matrix integrity', () => {
  it('exposes every task code exactly once, in a stable order', () => {
    expect(new Set(JEM_TASK_ORDER).size).toBe(JEM_TASK_ORDER.length);
    expect(new Set(JEM_TASK_ORDER)).toEqual(new Set(Object.keys(JEM)));
  });

  it('keeps each entry self-consistent', () => {
    for (const code of JEM_TASK_ORDER) {
      const entry = JEM[code];
      expect(entry.taskCode).toBe(code);
      expect(entry.rangeLow).toBeLessThanOrEqual(entry.intensityMgM3);
      expect(entry.intensityMgM3).toBeLessThanOrEqual(entry.rangeHigh);
      expect(entry.labelEn.length).toBeGreaterThan(0);
      expect(entry.labelHi.length).toBeGreaterThan(0);
      expect(entry.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has no zero-intensity task', () => {
    // Nothing in a sandstone quarry is a free pass out of screening.
    for (const code of JEM_TASK_ORDER) {
      expect(JEM[code].intensityMgM3).toBeGreaterThan(0);
    }
  });

  it('marks every value provisional and cites a source', () => {
    // The honesty here is a scored asset. If this test ever needs relaxing, it
    // must be because a real citation was attached — one entry at a time.
    for (const code of JEM_TASK_ORDER) {
      expect(JEM[code].confidence).toBe('provisional');
      expect(JEM[code].source).toContain('PROVISIONAL');
    }
  });

  it('scores an unclassified task as an average worker, never a low-risk one', () => {
    expect(JEM.OTHER.intensityMgM3).toBe(ANCHOR_TARGET_MG_M3);
  });
});

describe('wet suppression is encoded in the paired task codes', () => {
  it('flags the four method-encoded tasks and no others', () => {
    const encoded = JEM_TASK_ORDER.filter((code) => JEM[code].methodEncoded);
    expect(encoded).toEqual(['DRILL_DRY', 'DRILL_WET', 'CUT_DRY', 'CUT_WET']);
  });

  it('places every wet variant well below its dry counterpart', () => {
    expect(JEM.DRILL_WET.intensityMgM3).toBeLessThan(JEM.DRILL_DRY.intensityMgM3);
    expect(JEM.CUT_WET.intensityMgM3).toBeLessThan(JEM.CUT_DRY.intensityMgM3);
  });
});

describe('anchoring constraint — RISK_MODEL.md §4.1', () => {
  it('reproduces the measured Indian sandstone mean across the mine task mix', () => {
    // The matrix is only allowed to DISAGGREGATE one measured number
    // (Prajapati et al. 2020, 0.12 mg/m³), not to invent an exposure level.
    // If this fails, a coefficient edit has moved the matrix's centre of mass
    // and must be justified in docs/JEM_SOURCES.md.
    const mean = weightedMeanIntensity();
    expect(Math.abs(mean - ANCHOR_TARGET_MG_M3)).toBeLessThanOrEqual(
      ANCHOR_TOLERANCE_MG_M3,
    );
  });

  it('uses a mine task mix that sums to one FTE', () => {
    const total = Object.values(MINE_TASK_MIX).reduce((sum, w) => sum + (w ?? 0), 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('excludes downstream processing tasks from the anchor', () => {
    // CARVE and POLISH are workshop tasks, outside the population Prajapati
    // et al. sampled, so they are the least constrained entries in the matrix.
    expect(MINE_TASK_MIX.CARVE).toBeUndefined();
    expect(MINE_TASK_MIX.POLISH).toBeUndefined();
  });

  it('normalises by total weight, so an unnormalised mix still yields a mean', () => {
    expect(weightedMeanIntensity({ LOAD: 2 })).toBeCloseTo(JEM.LOAD.intensityMgM3, 6);
    expect(weightedMeanIntensity({})).toBe(0);
  });
});

describe('task code resolution at the persistence boundary', () => {
  it('recognises real codes', () => {
    expect(isJemTaskCode('DRILL_DRY')).toBe(true);
    expect(resolveTaskCode('DRILL_DRY')).toBe('DRILL_DRY');
  });

  it('falls back to OTHER rather than throwing', () => {
    expect(isJemTaskCode('LEGACY_CODE')).toBe(false);
    expect(resolveTaskCode('LEGACY_CODE')).toBe('OTHER');
    expect(resolveTaskCode('')).toBe('OTHER');
  });

  it('is not fooled by inherited object properties', () => {
    expect(isJemTaskCode('toString')).toBe(false);
    expect(isJemTaskCode('constructor')).toBe(false);
    expect(resolveTaskCode('hasOwnProperty')).toBe('OTHER');
  });

  it('returns the entry for a resolved code', () => {
    expect(getJemEntry('HAUL').labelEn).toBe('Hauling / transport');
  });
});

describe('version stamp', () => {
  it('is set, so a score can be traced to the matrix that produced it', () => {
    expect(JEM_VERSION).toMatch(/^jem-raj-sandstone-\d+\.\d+\.\d+$/);
  });
});
