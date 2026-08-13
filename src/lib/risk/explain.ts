/**
 * Human-readable explanations for a risk result, English and Hindi.
 *
 * Explainability is not a nicety here. It is the mechanism by which a health
 * worker can challenge a score, and the reason the system is auditable rather
 * than a black box. "Because 68% of this worker's exposure came from 12 years
 * of dry drilling" is the output that makes the tier trustworthy.
 *
 * Pure. No I/O, no clock, no formatting that depends on runtime locale — see
 * the note on `toFixed` below.
 *
 * EVERY reason string, in both languages, terminates in the non-diagnosis
 * statement. This is enforced by test, not by convention.
 */

import { getJemEntry } from './jem';
import type {
  EscalationCode,
  EscalationReason,
  TaskContribution,
  Tier,
} from './types';

/** Terminal clause on every reason string. Never render a reason without it. */
export const NOT_A_DIAGNOSIS_EN = 'Not a diagnosis.';
export const NOT_A_DIAGNOSIS_HI = 'यह निदान नहीं है।';

/**
 * Persistent notice required wherever a score appears (RISK_MODEL.md §9.4).
 * Exported here so the UI cannot drift from the model's own wording.
 */
export const PROVISIONAL_NOTICE_EN =
  'Exposure coefficients are provisional and pending field validation. ' +
  'This is not a diagnosis. Certification authority rests solely with the ' +
  'District Pneumoconiosis Board.';

export const PROVISIONAL_NOTICE_HI =
  'जोखिम गुणांक अनंतिम हैं और क्षेत्रीय सत्यापन की प्रतीक्षा में हैं। ' +
  'यह निदान नहीं है। प्रमाणन का अधिकार केवल जिला न्यूमोकोनियोसिस बोर्ड को है।';

const TIER_LABEL_EN: Readonly<Record<Tier, string>> = {
  1: 'Low',
  2: 'Moderate',
  3: 'High',
  4: 'Priority',
};

const TIER_LABEL_HI: Readonly<Record<Tier, string>> = {
  1: 'कम',
  2: 'मध्यम',
  3: 'उच्च',
  4: 'प्राथमिकता',
};

const ESCALATION_LABEL_EN: Readonly<Record<EscalationCode, string>> = {
  PRIOR_TB: 'prior TB',
  PEAK_INTENSITY: 'high peak exposure intensity',
  LATENCY: '15+ years since first exposure',
  CURRENT_SMOKER: 'current smoker',
};

const ESCALATION_LABEL_HI: Readonly<Record<EscalationCode, string>> = {
  PRIOR_TB: 'पूर्व टीबी',
  PEAK_INTENSITY: 'उच्च शिखर जोखिम तीव्रता',
  LATENCY: 'पहले जोखिम के 15+ वर्ष',
  CURRENT_SMOKER: 'वर्तमान धूम्रपान',
};

export function tierLabelEn(tier: Tier): string {
  return TIER_LABEL_EN[tier];
}

export function tierLabelHi(tier: Tier): string {
  return TIER_LABEL_HI[tier];
}

export function escalationLabelEn(code: EscalationCode): string {
  return ESCALATION_LABEL_EN[code];
}

export function escalationLabelHi(code: EscalationCode): string {
  return ESCALATION_LABEL_HI[code];
}

/**
 * Latin digits in both languages, deliberately.
 *
 * `toFixed` is locale-independent in JS, unlike `toLocaleString`, so output is
 * identical on every machine — a requirement for the golden-file test. Indian
 * government health forms use Latin digits, so this is also what a field worker
 * expects to read.
 */
function formatExposure(value: number): string {
  return value.toFixed(2);
}

/** Whole numbers render without a decimal: "12 years", not "12.0 years". */
function formatYears(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Reason strings report CALENDAR years, never FTE years.
 *
 * FTE years carry the hours-per-day multiplier and routinely exceed wall-clock
 * time — a 45-year career at 12-hour days is 67.5 FTE years. Printing that to a
 * health worker holding the man's file destroys trust in the whole output, and
 * trust in the explanation is the only reason the tier is actionable.
 */
function displayYears(contribution: TaskContribution): string {
  return formatYears(contribution.calendarYears);
}

export interface ReasonInput {
  tier: Tier;
  cumulativeExposure: number;
  topContributors: readonly TaskContribution[];
  escalations: readonly EscalationReason[];
  insufficientData: boolean;
}

export interface Reason {
  en: string;
  hi: string;
}

/**
 * Build the bilingual reason string.
 *
 * Only escalations that actually moved the tier are named. Rules that fired but
 * were dropped by the step cap remain in `escalations` for the detail panel;
 * naming them here would imply they affected the result when they did not.
 */
export function buildReason(input: ReasonInput): Reason {
  if (input.insufficientData) {
    return {
      en: `Interview incomplete — no exposure history recorded. ${NOT_A_DIAGNOSIS_EN}`,
      hi: `साक्षात्कार अधूरा — कोई जोखिम इतिहास दर्ज नहीं। ${NOT_A_DIAGNOSIS_HI}`,
    };
  }

  const exposure = formatExposure(input.cumulativeExposure);

  const enParts = [
    `${tierLabelEn(input.tier)} — ${exposure} mg/m³·years cumulative silica exposure`,
  ];
  const hiParts = [
    `${tierLabelHi(input.tier)} — संचयी सिलिका जोखिम ${exposure} mg/m³·वर्ष`,
  ];

  const [leading] = input.topContributors;
  if (leading !== undefined && leading.contribution > 0) {
    const entry = getJemEntry(leading.taskCode);
    const years = displayYears(leading);
    enParts.push(
      `mainly ${years} years of ${entry.labelEn.toLowerCase()} ` +
        `(${leading.percentOfTotal.toFixed(1)}% of total)`,
    );
    hiParts.push(
      `मुख्यतः ${entry.labelHi} के ${years} वर्षों से ` +
        `(कुल का ${leading.percentOfTotal.toFixed(1)}%)`,
    );
  }

  const applied = input.escalations.filter((escalation) => escalation.applied);

  let en = `${enParts.join(', ')}.`;
  let hi = `${hiParts.join(', ')}।`;

  if (applied.length > 0) {
    const enReasons = applied.map((e) => escalationLabelEn(e.code)).join(', ');
    const hiReasons = applied.map((e) => escalationLabelHi(e.code)).join(', ');
    en += ` Escalated for ${enReasons}.`;
    hi += ` ${hiReasons} के कारण श्रेणी बढ़ाई गई।`;
  }

  return {
    en: `${en} ${NOT_A_DIAGNOSIS_EN}`,
    hi: `${hi} ${NOT_A_DIAGNOSIS_HI}`,
  };
}
