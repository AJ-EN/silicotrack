/**
 * Job-Exposure Matrix — Rajasthan sandstone.
 *
 * Assigns a respirable crystalline silica (RCS) intensity, in mg/m³, to each
 * sandstone task. Consumed by `engine.ts` as the `I_task` term of:
 *
 *     CE = Σ ( I_task × M_controls × duration_years )
 *
 * ---------------------------------------------------------------------------
 * EVERY VALUE IN THIS FILE IS PROVISIONAL.
 *
 * A validated Rajasthan sandstone JEM does not exist in published form. No
 * task-stratified RCS measurement for this workforce has been published. These
 * are apportionment estimates, not measurements, and the UI must say so
 * wherever a score derived from them appears.
 *
 * See `docs/JEM_SOURCES.md` for per-entry provenance and `docs/RISK_MODEL.md`
 * §4 for the constraint these values are required to satisfy.
 * ---------------------------------------------------------------------------
 *
 * WHY THESE NUMBERS ARE NOT ARBITRARY, DESPITE BEING UNSOURCED
 *
 * The matrix has one hard external anchor. Prajapati et al. (2020) measured a
 * mean RCS of 0.12 mg/m³ across Indian sandstone mines. This file's job is to
 * *disaggregate* that measured mean across tasks — dry drilling above it,
 * haulage below it — not to invent a new exposure level.
 *
 * The FTE-weighted mean of the mine-based tasks is therefore pinned to
 * ~0.12 mg/m³ by `MINE_TASK_MIX` / `weightedMeanIntensity()`, which exist so a
 * test can assert the constraint holds rather than leaving it aspirational.
 *
 * That splits the uncertainty into two honest halves:
 *   - the matrix's CENTRE is measured           → defensible
 *   - the matrix's SPREAD across tasks is not   → provisional, and the whole
 *                                                 point of the project
 */

/** Respirable crystalline silica, mg/m³. Never respirable dust — see below. */
export type JemTaskCode =
  | 'DRILL_DRY'
  | 'DRILL_WET'
  | 'CUT_DRY'
  | 'CUT_WET'
  | 'DRESS'
  | 'CARVE'
  | 'CRUSH'
  | 'POLISH'
  | 'LOAD'
  | 'HAUL'
  | 'CLEAN_WASTE'
  | 'OTHER';

export type JemConfidence = 'high' | 'medium' | 'low' | 'provisional';

export interface JemEntry {
  taskCode: JemTaskCode;
  labelEn: string;
  labelHi: string;
  /** Point estimate, mg/m³ RCS. Personal breathing zone, 8-hour TWA basis. */
  intensityMgM3: number;
  /** Plausible lower bound, mg/m³. Not a confidence interval — no sampling distribution exists. */
  rangeLow: number;
  /** Plausible upper bound, mg/m³. */
  rangeHigh: number;
  source: string;
  confidence: JemConfidence;
  /** ISO date. */
  lastReviewed: string;
  /**
   * True when wet/dry suppression is already baked into `intensityMgM3`.
   *
   * The engine MUST NOT apply the `m_method` control modifier to entries where
   * this is true, or suppression is counted twice and the worker's exposure is
   * halved a second time. DRILL_WET at 0.05 would become 0.025 — a silent 2×
   * error in the direction of under-triage, on the exact workers the system
   * exists to find.
   */
  methodEncoded: boolean;
}

/**
 * Bumped on any coefficient change. Persisted with every RiskAssessment so a
 * score can always be traced to the matrix that produced it.
 */
export const JEM_VERSION = 'jem-raj-sandstone-0.1.0';

const LAST_REVIEWED = '2026-08-13';

/**
 * Shared provenance string. Every entry carries it because every entry has the
 * same epistemic status: apportioned, not measured.
 */
const PROVISIONAL_SOURCE =
  'PROVISIONAL — expert estimate pending validation. Centre apportioned from ' +
  'Prajapati et al. 2020 (J Occup Environ Hyg 17:531-537), mean RCS 0.12 mg/m³ ' +
  'across Indian sandstone mines. Relative ordering across tasks is mechanistic ' +
  'reasoning about dust generation, energy input and enclosure. No task-stratified ' +
  'RCS measurement for Rajasthan sandstone has been published.';

export const JEM: Readonly<Record<JemTaskCode, JemEntry>> = {
  // --- Drilling -------------------------------------------------------------
  // Highest routine intensity in the mine. High energy input directly into
  // rock, at the breathing zone, usually with no suppression.
  DRILL_DRY: {
    taskCode: 'DRILL_DRY',
    labelEn: 'Dry drilling',
    labelHi: 'सूखी ड्रिलिंग',
    intensityMgM3: 0.28,
    rangeLow: 0.1,
    rangeHigh: 0.75,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: true,
  },
  // Water suppression at the bit is the single most effective control in this
  // sector. The DRILL_WET : DRILL_DRY ratio here is 0.18 — an ~82% reduction.
  // NOTE: this is materially stronger than the generic m_method modifier of
  // 0.50 proposed in RISK_MODEL.md §5. Both are provisional; they disagree and
  // must be reconciled once suppression efficacy is sourced.
  DRILL_WET: {
    taskCode: 'DRILL_WET',
    labelEn: 'Wet drilling',
    labelHi: 'गीली ड्रिलिंग',
    intensityMgM3: 0.05,
    rangeLow: 0.015,
    rangeHigh: 0.15,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: true,
  },

  // --- Cutting --------------------------------------------------------------
  // Not in the requested task list, but Rajavel et al. 2020 found 94.5% of male
  // Jodhpur sandstone workers did "stone cutting, drilling or both". A matrix
  // that cannot encode cutting cannot represent the workforce it is built for.
  CUT_DRY: {
    taskCode: 'CUT_DRY',
    labelEn: 'Dry cutting / sawing',
    labelHi: 'सूखी कटाई',
    intensityMgM3: 0.18,
    rangeLow: 0.06,
    rangeHigh: 0.5,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: true,
  },
  CUT_WET: {
    taskCode: 'CUT_WET',
    labelEn: 'Wet cutting / sawing',
    labelHi: 'गीली कटाई',
    intensityMgM3: 0.04,
    rangeLow: 0.01,
    rangeHigh: 0.12,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: true,
  },

  // --- Shaping --------------------------------------------------------------
  // Hand or pneumatic chiselling to square a block. Lower energy than drilling,
  // but sustained and close to the face.
  DRESS: {
    taskCode: 'DRESS',
    labelEn: 'Stone dressing',
    labelHi: 'पत्थर घड़ाई',
    intensityMgM3: 0.12,
    rangeLow: 0.04,
    rangeHigh: 0.32,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },
  // Placed ABOVE dressing despite lower energy input: carving is typically done
  // in small, poorly ventilated workshops for long continuous shifts, so dust
  // accumulates rather than dispersing. Enclosure raises exposure here — it is
  // not the protective enclosure the m_enclosure modifier assumes.
  CARVE: {
    taskCode: 'CARVE',
    labelEn: 'Carving',
    labelHi: 'नक्काशी',
    intensityMgM3: 0.15,
    rangeLow: 0.05,
    rangeHigh: 0.4,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },

  // --- Processing -----------------------------------------------------------
  // Mechanical comminution: high fines generation, and crusher operators are
  // often stationed downwind of their own plant.
  CRUSH: {
    taskCode: 'CRUSH',
    labelEn: 'Crushing',
    labelHi: 'पत्थर पिसाई',
    intensityMgM3: 0.22,
    rangeLow: 0.08,
    rangeHigh: 0.55,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },
  // Dry abrasive finishing. Particle size distribution skews fine, which is the
  // fraction that reaches the alveoli, so respirable share is higher than the
  // visible dust cloud suggests.
  POLISH: {
    taskCode: 'POLISH',
    labelEn: 'Polishing / grinding',
    labelHi: 'घिसाई एवं पॉलिश',
    intensityMgM3: 0.17,
    rangeLow: 0.05,
    rangeHigh: 0.45,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },

  // --- Materials handling ---------------------------------------------------
  // Re-suspension of settled dust rather than primary generation. Lower, but
  // not trivial: Rajavel et al. found 93.4% of female workers in loading and
  // waste cleaning, so these entries carry most of the women in the cohort.
  LOAD: {
    taskCode: 'LOAD',
    labelEn: 'Loading',
    labelHi: 'पत्थर लदान',
    intensityMgM3: 0.05,
    rangeLow: 0.02,
    rangeHigh: 0.15,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },
  // Lowest entry. Partial cab enclosure, but unsealed haul roads keep it
  // non-zero. Nothing in this matrix is zero.
  HAUL: {
    taskCode: 'HAUL',
    labelEn: 'Hauling / transport',
    labelHi: 'ढुलाई',
    intensityMgM3: 0.025,
    rangeLow: 0.01,
    rangeHigh: 0.08,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },
  CLEAN_WASTE: {
    taskCode: 'CLEAN_WASTE',
    labelEn: 'Waste / debris clearing',
    labelHi: 'पत्थर मलबे की सफाई',
    intensityMgM3: 0.07,
    rangeLow: 0.02,
    rangeHigh: 0.2,
    source: PROVISIONAL_SOURCE,
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },

  // --- Fallback -------------------------------------------------------------
  // Set deliberately AT the measured sandstone mean, so an unclassified task is
  // scored as an average sandstone worker rather than as a low-risk one. An
  // unknown task must never be a free pass out of screening.
  OTHER: {
    taskCode: 'OTHER',
    labelEn: 'Other sandstone work',
    labelHi: 'अन्य कार्य',
    intensityMgM3: 0.12,
    rangeLow: 0.04,
    rangeHigh: 0.3,
    source:
      'PROVISIONAL — set to the Prajapati et al. 2020 measured sandstone mine ' +
      'mean of 0.12 mg/m³ so that an unclassified task scores as an average ' +
      'worker, never as a low-risk one.',
    confidence: 'provisional',
    lastReviewed: LAST_REVIEWED,
    methodEncoded: false,
  },
};

/** Ordered for stable UI rendering. Object key order is not a contract. */
export const JEM_TASK_ORDER: readonly JemTaskCode[] = [
  'DRILL_DRY',
  'DRILL_WET',
  'CUT_DRY',
  'CUT_WET',
  'DRESS',
  'CARVE',
  'CRUSH',
  'POLISH',
  'LOAD',
  'HAUL',
  'CLEAN_WASTE',
  'OTHER',
];

export function isJemTaskCode(value: string): value is JemTaskCode {
  return Object.prototype.hasOwnProperty.call(JEM, value);
}

export function getJemEntry(taskCode: JemTaskCode): JemEntry {
  return JEM[taskCode];
}

/**
 * Boundary helper for values arriving from the DB or a sync payload as strings.
 * Falls back to OTHER rather than throwing: a worker with an unrecognised task
 * code must still receive a score, because dropping them would remove them from
 * the screening queue entirely.
 */
export function resolveTaskCode(value: string): JemTaskCode {
  return isJemTaskCode(value) ? value : 'OTHER';
}

// ---------------------------------------------------------------------------
// Anchoring constraint — see RISK_MODEL.md §4.1
// ---------------------------------------------------------------------------

/**
 * Approximate full-time-equivalent task mix for a Rajasthan sandstone MINE.
 *
 * Shape informed by Rajavel et al. 2020 (Jodhpur, 15 mines, 174 workers): men
 * predominantly cutting/drilling (94.5%), women predominantly loading and waste
 * clearing (93.4%). The specific weights are a calibration choice — the study
 * reports role proportions by sex, not FTE time-allocation across tasks.
 *
 * CARVE and POLISH are deliberately excluded: they are downstream processing
 * tasks, not mine tasks, so they are outside the population Prajapati et al.
 * sampled and cannot be anchored by it.
 */
export const MINE_TASK_MIX: Readonly<Partial<Record<JemTaskCode, number>>> = {
  DRILL_DRY: 0.15,
  DRILL_WET: 0.05,
  CUT_DRY: 0.25,
  CUT_WET: 0.05,
  DRESS: 0.1,
  LOAD: 0.2,
  HAUL: 0.1,
  CLEAN_WASTE: 0.1,
};

/** Prajapati et al. 2020 measured mean RCS for Indian sandstone mines, mg/m³. */
export const ANCHOR_TARGET_MG_M3 = 0.12;

/**
 * Tolerance for the anchoring assertion, mg/m³. Wide, because the target is a
 * cross-mine mean and the mix weights are themselves estimates. It is a
 * guard against drift, not a precision claim.
 */
export const ANCHOR_TOLERANCE_MG_M3 = 0.02;

/**
 * FTE-weighted mean intensity across a task mix. Normalises by total weight, so
 * a mix whose weights do not sum to 1 still yields a mean rather than a scaled
 * artefact.
 *
 * Exists so `jem.test.ts` can assert the matrix still disaggregates the one
 * measured number it is allowed to assume. Any coefficient edit that breaks
 * this must be justified in docs/JEM_SOURCES.md.
 */
export function weightedMeanIntensity(
  mix: Readonly<Partial<Record<JemTaskCode, number>>> = MINE_TASK_MIX,
): number {
  let weightSum = 0;
  let weightedTotal = 0;

  for (const [code, weight] of Object.entries(mix)) {
    if (weight === undefined || !isJemTaskCode(code)) continue;
    weightSum += weight;
    weightedTotal += JEM[code].intensityMgM3 * weight;
  }

  return weightSum === 0 ? 0 : weightedTotal / weightSum;
}

// ---------------------------------------------------------------------------
// Control modifiers — the M_controls term. See RISK_MODEL.md §5.
// ---------------------------------------------------------------------------

/**
 * ALL FOUR MODIFIER SETS ARE PROVISIONAL AND UNSOURCED.
 *
 * They live alongside the JEM because they are the same class of thing —
 * provisional exposure coefficients — and share a provenance document
 * (docs/JEM_SOURCES.md §7).
 *
 * `m_method` is deliberately NOT applied to entries whose `methodEncoded` flag
 * is true; those task codes already distinguish wet from dry. Applying both
 * halves the value a second time. See JEM_SOURCES.md §5.1.
 */
export const CONTROL_MODIFIERS = {
  method: { wet: 0.5, dry: 1.0 },
  enclosure: { enclosed: 0.6, open: 1.0 },
  ppe: { consistent: 0.7, intermittent: 0.9, none: 1.0 },
  site: { underground: 1.2, surface: 1.0 },
} as const;

/**
 * Floor on the product of all control modifiers.
 *
 * Controls in unregulated small quarries are not the controls measured in
 * engineered-control studies. Without a floor, a worker who answers "yes" to
 * every control question receives a 0.5 × 0.6 × 0.7 = 0.21 multiplier and is
 * scored as barely exposed — systematically under-triaging the workers least
 * able to challenge the result.
 *
 * Self-reported PPE use in a sector with no fit-testing is the weakest input in
 * the entire interview. This bounds how much damage it can do.
 */
export const MIN_CONTROL_PRODUCT = 0.25;
