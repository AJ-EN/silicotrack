/**
 * Synthetic cohort generator.
 *
 *     npm run seed              write to the database
 *     npm run seed -- --dry-run compute and print the distribution only
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  EVERY RECORD THIS SCRIPT PRODUCES IS FABRICATED.
 *
 *  No real worker, quarry, camp, referral or board decision is represented.
 *  Worker IDs carry a `SYN-` prefix, phone numbers use a non-allocated
 *  numbering block, and names are drawn from a fixed pool. Nothing here has
 *  ever been near a patient record (CLAUDE.md §2.4).
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Fully deterministic: a fixed-seed PRNG, and a fixed reference date passed to
 * the risk engine. Re-running produces a byte-identical cohort, so screenshots,
 * the demo video and dashboard figures stay stable between runs.
 *
 * The cohort is shaped to be *plausible*, not to flatter the model. Most
 * workers are not tier 4; the referral pipeline loses most of the people who
 * enter it, with the largest single loss at "no symptoms" — because that is
 * what the state's own published figures show.
 */

import 'dotenv/config';

import { prisma } from '../src/lib/db/client';
import { assessRisk } from '../src/lib/risk/engine';
import type {
  ExposureSegmentInput,
  RiskResult,
  SmokingStatus,
  WorkerRiskFacts,
} from '../src/lib/risk/types';

const DRY_RUN = process.argv.includes('--dry-run');

/** Frozen. The engine never reads a clock; neither does the seed. */
const REFERENCE_DATE = '2026-08-13';
const REFERENCE_YEAR = 2026;

const COHORT_SIZE = 500;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32). Math.random() would make the cohort — and
// therefore every screenshot and dashboard number — different on every run.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x51_11_c0);

const rand = (): number => rng();
const randInt = (min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));
const chance = (probability: number): boolean => rand() < probability;

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('pick() from empty array');
  return item;
}

function pickWeighted<T extends string>(weights: Readonly<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  const last = entries[entries.length - 1];
  if (last === undefined) throw new Error('pickWeighted() with no entries');
  return last[0];
}

/** Triangular distribution — a cheap way to get a realistic age curve. */
function triangular(min: number, peak: number, max: number): number {
  const u = rand();
  const split = (peak - min) / (max - min);
  return u < split
    ? Math.round(min + Math.sqrt(u * (max - min) * (peak - min)))
    : Math.round(max - Math.sqrt((1 - u) * (max - min) * (max - peak)));
}

// ---------------------------------------------------------------------------
// Geography. Blocks are real administrative blocks in each district; village
// names are invented.
// ---------------------------------------------------------------------------

interface DistrictProfile {
  name: string;
  code: string;
  blocks: readonly string[];
  villages: readonly string[];
  /** Share of the cohort drawn from this district. */
  weight: number;
  /**
   * Shifts the archetype mix toward higher-intensity tasks. Karauli is the
   * sandstone quarrying heartland and carries the highest reported prevalence
   * (78.5%); Bhilwara's mixed-mineral processing sits lower (README).
   * This shapes the SYNTHETIC cohort only — it is not a model coefficient and
   * the engine never sees it.
   */
  intensityBias: number;
}

const DISTRICTS: readonly DistrictProfile[] = [
  {
    name: 'Karauli',
    code: 'KRL',
    blocks: ['Todabhim', 'Hindaun', 'Sapotra', 'Karauli', 'Nadoti', 'Mandrayal'],
    villages: ['Bharkholi', 'Gangapur Khurd', 'Rampura', 'Salempur', 'Khedla', 'Jeerota', 'Bugda', 'Amargarh'],
    weight: 0.32,
    intensityBias: 1.7,
  },
  {
    name: 'Jodhpur',
    code: 'JDH',
    blocks: ['Balesar', 'Shergarh', 'Osian', 'Bhopalgarh', 'Luni', 'Bilara'],
    villages: ['Sarecha', 'Dhundhara', 'Keru', 'Banar', 'Sathin', 'Chamu', 'Doli', 'Bhawad'],
    weight: 0.3,
    intensityBias: 1.15,
  },
  {
    name: 'Dausa',
    code: 'DSA',
    blocks: ['Dausa', 'Bandikui', 'Lalsot', 'Sikrai', 'Mahwa', 'Baswa'],
    villages: ['Kalakho', 'Nangal Rajawatan', 'Bhandarej', 'Geejgarh', 'Jhilmili', 'Rahuwas', 'Mandawar'],
    weight: 0.22,
    intensityBias: 1.0,
  },
  {
    name: 'Bhilwara',
    code: 'BHL',
    blocks: ['Mandalgarh', 'Jahazpur', 'Asind', 'Banera', 'Shahpura', 'Raipur'],
    villages: ['Bijoliya', 'Kotri', 'Gulabpura', 'Hurda', 'Sareri', 'Karera', 'Pandher'],
    weight: 0.16,
    intensityBias: 0.5,
  },
];

// Fixed name pool. Combinations are synthetic; any resemblance to a real person
// is coincidental and unintended.
const MALE_FIRST = ['Ramlal', 'Mohan', 'Bhanwar', 'Kishan', 'Prakash', 'Devi Singh', 'Hukam', 'Nathu', 'Shankar', 'Girdhari', 'Mangi', 'Sohan', 'Rameshwar', 'Bheru', 'Chhotu', 'Jagdish', 'Om Prakash', 'Sitaram'];
const FEMALE_FIRST = ['Sita', 'Kamla', 'Gyarsi', 'Mohini', 'Bhanwari', 'Sunita', 'Radha', 'Manju', 'Pushpa', 'Lali', 'Santosh', 'Dhapu'];
const SURNAMES = ['Meena', 'Gurjar', 'Bairwa', 'Saini', 'Jat', 'Regar', 'Kumhar', 'Prajapat', 'Banjara', 'Salvi', 'Jangid', 'Suthar', 'Nayak', 'Bhil'];

// ---------------------------------------------------------------------------
// Career archetypes. Each maps to a sequence of JEM task codes.
// ---------------------------------------------------------------------------

type Archetype =
  | 'DRILLER'
  | 'CUTTER'
  | 'DRESSER'
  | 'CRUSHER'
  | 'CARVER'
  | 'POLISHER'
  | 'LOADER'
  | 'HAULER'
  | 'SUPPORT';

/** Task sequence for a career, earliest first. */
const ARCHETYPE_TASKS: Readonly<Record<Archetype, readonly string[]>> = {
  DRILLER: ['LOAD', 'DRILL_DRY'],
  CUTTER: ['LOAD', 'CUT_DRY'],
  DRESSER: ['DRESS'],
  CRUSHER: ['LOAD', 'CRUSH'],
  CARVER: ['DRESS', 'CARVE'],
  POLISHER: ['POLISH'],
  LOADER: ['LOAD'],
  HAULER: ['HAUL'],
  SUPPORT: ['CLEAN_WASTE', 'LOAD'],
};

/**
 * Men in quarry districts.
 *
 * Support roles dominate, as they do in a real quarry workforce: for every
 * driller at the face there are several people loading, hauling and clearing
 * waste. Getting this mix wrong is the fastest way to produce a cohort where
 * everyone looks high-risk.
 */
const MALE_ARCHETYPES: Readonly<Record<Archetype, number>> = {
  DRILLER: 0.1,
  CUTTER: 0.12,
  DRESSER: 0.11,
  CRUSHER: 0.05,
  CARVER: 0.05,
  POLISHER: 0.03,
  LOADER: 0.2,
  HAULER: 0.18,
  SUPPORT: 0.16,
};

/**
 * Women are concentrated in loading and waste clearing — the pattern reported
 * for Jodhpur sandstone mines. Lower-intensity tasks, but long tenures, so they
 * accumulate through duration rather than concentration.
 */
const FEMALE_ARCHETYPES: Readonly<Record<Archetype, number>> = {
  DRILLER: 0.01,
  CUTTER: 0.02,
  DRESSER: 0.13,
  CRUSHER: 0.01,
  CARVER: 0.02,
  POLISHER: 0.02,
  LOADER: 0.37,
  HAULER: 0.07,
  SUPPORT: 0.35,
};

/** Tasks whose wet variant exists as a separate JEM code. */
const WET_VARIANT: Readonly<Record<string, string>> = {
  DRILL_DRY: 'DRILL_WET',
  CUT_DRY: 'CUT_WET',
};

// ---------------------------------------------------------------------------
// Worker generation
// ---------------------------------------------------------------------------

interface GeneratedWorker {
  workerId: string;
  name: string;
  age: number;
  sex: 'male' | 'female';
  district: string;
  block: string;
  village: string;
  phone: string | null;
  smokingStatus: SmokingStatus;
  priorTB: boolean;
  createdBy: string;
  createdAt: string;
  segments: (ExposureSegmentInput & { material: string; siteName: string | null })[];
  result: RiskResult;
}

function isoInstant(daysAgo: number, index: number): string {
  // Derived arithmetically from the fixed reference date rather than from a
  // clock, so the cohort stays byte-identical across runs.
  const base = Date.UTC(2026, 7, 13, 6, 0, 0) - daysAgo * 86_400_000 + index * 37_000;
  return `${new Date(base).toISOString().slice(0, 19)}Z`;
}

function isoDay(offsetDays: number): string {
  const base = Date.UTC(2026, 7, 13) + offsetDays * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

function generateWorker(index: number, district: DistrictProfile): GeneratedWorker {
  const sex: 'male' | 'female' = chance(0.78) ? 'male' : 'female';
  const age = triangular(18, 34, 66);

  // Most start young. Cap tenure so nobody has a 50-year career at 40.
  const startAge = randInt(15, Math.min(30, Math.max(16, age - 1)));
  const totalTenure = Math.max(1, age - startAge);

  const archetypeWeights = sex === 'male' ? MALE_ARCHETYPES : FEMALE_ARCHETYPES;
  const biased = Object.fromEntries(
    (Object.entries(archetypeWeights) as [Archetype, number][]).map(([key, weight]) => {
      const isHighIntensity =
        key === 'DRILLER' || key === 'CUTTER' || key === 'CRUSHER';
      return [key, isHighIntensity ? weight * district.intensityBias : weight];
    }),
  ) as Record<Archetype, number>;

  const archetype = pickWeighted(biased);
  const tasks = ARCHETYPE_TASKS[archetype];

  // Split the career across the archetype's task sequence. Early tasks are
  // entry-level and shorter; the main task carries the remainder.
  const segments: GeneratedWorker['segments'] = [];
  let cursor = REFERENCE_YEAR - totalTenure;

  // A small share of registrations are incomplete — someone was registered at a
  // camp but the exposure interview was never finished. These must surface as
  // "interview incomplete", never as low risk.
  const interviewIncomplete = chance(0.025);

  if (!interviewIncomplete) {
    tasks.forEach((taskCode, position) => {
      const isLast = position === tasks.length - 1;
      const remaining = REFERENCE_YEAR - cursor;
      if (remaining < 1) return;

      const span = isLast
        ? remaining
        : Math.max(1, Math.min(remaining - 1, Math.round(totalTenure * 0.3)));

      const startYear = cursor;
      const endYear = isLast ? null : cursor + span - 1;
      cursor += span;

      // Wet methods arrived late and unevenly. Segments beginning after 2015
      // are more likely to use them, and Bhilwara's processing sites more so.
      const wetAdoption =
        (startYear >= 2015 ? 0.28 : 0.06) * (district.intensityBias < 1 ? 1.6 : 1);
      const useWet = chance(wetAdoption);
      const wetVariant = WET_VARIANT[taskCode];
      const resolvedTask = useWet && wetVariant !== undefined ? wetVariant : taskCode;

      const isWorkshop = resolvedTask === 'CARVE' || resolvedTask === 'POLISH';

      segments.push({
        taskCode: resolvedTask,
        material: pick(['sandstone', 'sandstone', 'sandstone', 'quartzite', 'granite']),
        method: useWet ? 'wet' : 'dry',
        enclosure: isWorkshop ? (chance(0.7) ? 'enclosed' : 'open') : chance(0.08) ? 'enclosed' : 'open',
        // PPE in unregulated quarries is scarce and almost never fit-tested.
        ppeUse: pickWeighted({ none: 0.55, intermittent: 0.35, consistent: 0.1 }),
        siteType: chance(0.06) ? 'underground' : 'surface',
        startYear,
        endYear,
        // Seasonal and migrant work is the norm, not the exception.
        monthsPerYear: pickWeighted({ '12': 0.22, '10': 0.24, '8': 0.28, '6': 0.19, '4': 0.07 }) as unknown as number,
        hoursPerDay: pickWeighted({ '8': 0.42, '9': 0.23, '10': 0.2, '12': 0.15 }) as unknown as number,
        siteName: chance(0.55) ? `${pick(district.villages)} Quarry ${randInt(1, 9)}` : null,
      });
    });
  }

  // Coerce the string keys used for weighting back to numbers.
  for (const segment of segments) {
    segment.monthsPerYear = Number(segment.monthsPerYear);
    segment.hoursPerDay = Number(segment.hoursPerDay);
  }

  // Broadly consistent with GATS-2 male tobacco smoking prevalence, adjusted
  // upward for manual-labour occupational groups.
  const smokingStatus: SmokingStatus =
    sex === 'male'
      ? pickWeighted({ never: 0.5, former: 0.19, current: 0.31 })
      : pickWeighted({ never: 0.89, former: 0.05, current: 0.06 });

  // Elevated relative to the general population: silica-exposed workers carry
  // a substantially higher TB burden, and this cohort skews long-tenure.
  const priorTB = chance(totalTenure >= 15 ? 0.12 : 0.05);

  const worker: WorkerRiskFacts = { smokingStatus, priorTB };
  const result = assessRisk({ segments, worker, referenceDate: REFERENCE_DATE });

  const firstName = sex === 'male' ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
  const serial = String(index + 1).padStart(5, '0');

  return {
    workerId: `SYN-${serial}`,
    name: `${firstName} ${pick(SURNAMES)}`,
    age,
    sex,
    district: district.name,
    block: pick(district.blocks),
    village: pick(district.villages),
    // Non-allocated numbering block, sequential — well-formed for the UI,
    // impossible to mistake for a real subscriber.
    phone: chance(0.82) ? `+91 60000 ${serial}` : null,
    smokingStatus,
    priorTB,
    createdBy: `ASHA-${district.code}-${String(randInt(1, 24)).padStart(2, '0')}`,
    createdAt: isoInstant(randInt(30, 400), index),
    segments,
    result,
  };
}

function buildCohort(): GeneratedWorker[] {
  const workers: GeneratedWorker[] = [];
  for (let index = 0; index < COHORT_SIZE; index++) {
    const district = pickWeighted(
      Object.fromEntries(DISTRICTS.map((d) => [d.name, d.weight])) as Record<string, number>,
    );
    const profile = DISTRICTS.find((d) => d.name === district);
    if (profile === undefined) throw new Error(`unknown district ${district}`);
    workers.push(generateWorker(index, profile));
  }
  return workers;
}

// ---------------------------------------------------------------------------
// Camps, screenings, referrals
// ---------------------------------------------------------------------------

const REFERRAL_STAGES = [
  'REGISTERED',
  'PRIMARY_CHECKUP',
  'RADIOGRAPHER',
  'RADIOLOGIST',
  'MO_APPROVAL',
  'BOARD',
  'CERTIFIED',
  'DISBURSED',
] as const;

interface Plan {
  camps: {
    campId: string;
    district: string;
    block: string;
    date: string;
    deviceId: string;
    capacity: number;
  }[];
  invites: {
    id: string;
    campId: string;
    workerId: string;
    priorityRank: number;
    tierAtInvite: number;
    attended: boolean;
  }[];
  screenings: {
    id: string;
    workerId: string;
    campId: string;
    date: string;
    modality: string;
    outcome: string;
    aiFlag: string | null;
    radiologistRead: string | null;
  }[];
  referrals: {
    id: string;
    workerId: string;
    toBoard: string;
    status: string;
    slotDate: string | null;
    lastContactAt: string | null;
    daysInStage: number;
  }[];
  stageEvents: {
    id: string;
    referralId: string;
    stage: string;
    enteredAt: string;
    daysInPreviousStage: number | null;
    note: string | null;
  }[];
}

function planOperations(workers: GeneratedWorker[]): Plan {
  const plan: Plan = { camps: [], invites: [], screenings: [], referrals: [], stageEvents: [] };

  let campIndex = 0;
  let inviteIndex = 0;
  let screeningIndex = 0;
  let referralIndex = 0;
  let eventIndex = 0;

  for (const district of DISTRICTS) {
    const blocks = district.blocks.slice(0, 4);

    for (const block of blocks) {
      // Camps run both sides of the reference date: some held, some upcoming.
      const dayOffset = randInt(-150, 25);
      const campId = `CAMP-${district.code}-${String(++campIndex).padStart(3, '0')}`;
      const capacity = pick([30, 40, 40, 50]);
      const campDate = isoDay(dayOffset);
      const alreadyHeld = dayOffset < 0;

      plan.camps.push({
        campId,
        district: district.name,
        block,
        date: campDate,
        // Handheld units already deployed under NTEP.
        deviceId: `NTEP-HH-${district.code}-${randInt(1, 3)}`,
        capacity,
      });

      // This is the camp planner's job in miniature: rank the block's workers
      // by tier, then by cumulative exposure, and invite up to capacity.
      const candidates = workers
        .filter((w) => w.district === district.name && w.block === block)
        .sort(
          (a, b) =>
            b.result.tier - a.result.tier ||
            b.result.cumulativeExposure - a.result.cumulativeExposure ||
            a.workerId.localeCompare(b.workerId),
        )
        .slice(0, capacity);

      candidates.forEach((worker, position) => {
        // Attendance falls off down the list: the highest-risk workers are also
        // the ones ASHA workers follow up hardest.
        const attended = alreadyHeld && chance(position < 10 ? 0.86 : 0.68);

        plan.invites.push({
          id: `INV-${String(++inviteIndex).padStart(5, '0')}`,
          campId,
          workerId: worker.workerId,
          priorityRank: position + 1,
          tierAtInvite: worker.result.tier,
          attended,
        });

        if (!attended) return;

        // Screening outcome. The AI application already on the Raj Silicosis
        // Portal reads the film; SilicoTrack never does.
        const abnormalChance = 0.06 + worker.result.tier * 0.07;
        const abnormal = chance(abnormalChance);
        const inconclusive = !abnormal && chance(0.07);
        const outcome = abnormal ? 'ABNORMAL' : inconclusive ? 'INCONCLUSIVE' : 'NORMAL';

        plan.screenings.push({
          id: `SCR-${String(++screeningIndex).padStart(5, '0')}`,
          workerId: worker.workerId,
          campId,
          date: campDate,
          modality: 'CXR_HANDHELD',
          outcome,
          aiFlag: abnormal ? pick(['SUSPECT', 'SUSPECT', 'REVIEW']) : 'NO_FINDING',
          radiologistRead: abnormal
            ? pick(['1/0', '1/1', '1/1', '2/1', '2/2'])
            : inconclusive
              ? '0/1'
              : '0/0',
        });

        if (outcome === 'NORMAL') return;

        // --- Referral into the state pipeline ---
        const referralId = `REF-${String(++referralIndex).padStart(5, '0')}`;
        const startOffset = dayOffset + randInt(2, 10);

        /**
         * Stage progression, tuned to the state's published outcome pattern.
         *
         * The single largest bucket is rejection at CHC level for having no
         * symptoms — 11,288 of 21,871 applications. Early silicosis is
         * asymptomatic, so this criterion rejects hardest exactly where
         * detection matters most. The seed reproduces that shape so the
         * dashboard shows the real failure, not a flattering one.
         */
        const roll = rand();
        let finalStageIndex: number;
        let terminal: string | null = null;

        if (roll < 0.44) {
          // Rejected at primary checkup for absent symptoms.
          finalStageIndex = 1;
          terminal = 'REJECTED_NO_SYMPTOMS';
        } else if (roll < 0.54) {
          finalStageIndex = randInt(1, 3);
          terminal = 'LOST_TO_FOLLOWUP';
        } else if (roll < 0.63) {
          finalStageIndex = 3;
          terminal = 'REJECTED_POST_XRAY';
        } else if (roll < 0.86) {
          // Still moving through the pipeline.
          finalStageIndex = randInt(2, 5);
        } else if (roll < 0.95) {
          finalStageIndex = 6; // CERTIFIED
        } else {
          finalStageIndex = 7; // DISBURSED
        }

        let cursorOffset = startOffset;
        let previousGap: number | null = null;

        for (let stage = 0; stage <= finalStageIndex; stage++) {
          const stageName = REFERRAL_STAGES[stage];
          if (stageName === undefined) break;
          plan.stageEvents.push({
            id: `RSE-${String(++eventIndex).padStart(6, '0')}`,
            referralId,
            stage: stageName,
            enteredAt: isoInstant(-cursorOffset, eventIndex),
            daysInPreviousStage: previousGap,
            note: null,
          });
          // Radiologist → MO approval is the documented bottleneck.
          const gap = stage === 3 ? randInt(6, 34) : randInt(2, 18);
          previousGap = gap;
          cursorOffset += gap;
        }

        let status: string;
        if (terminal !== null) {
          plan.stageEvents.push({
            id: `RSE-${String(++eventIndex).padStart(6, '0')}`,
            referralId,
            stage: terminal,
            enteredAt: isoInstant(-cursorOffset, eventIndex),
            daysInPreviousStage: previousGap,
            note:
              terminal === 'REJECTED_NO_SYMPTOMS'
                ? 'Rejected at CHC: no symptoms reported at primary checkup.'
                : terminal === 'LOST_TO_FOLLOWUP'
                  ? 'No contact after three attempts.'
                  : 'Radiograph reviewed, ILO category below certification threshold.',
          });
          status = terminal;
        } else {
          const stageName = REFERRAL_STAGES[finalStageIndex];
          status = stageName ?? 'REGISTERED';
        }

        // Days in the current stage, measured to the reference date.
        const daysInStage = Math.max(0, -dayOffset - (cursorOffset - startOffset));

        plan.referrals.push({
          id: referralId,
          workerId: worker.workerId,
          toBoard: `DPB ${district.name}`,
          status,
          slotDate: finalStageIndex >= 5 ? isoDay(cursorOffset + randInt(5, 30)) : null,
          lastContactAt: isoInstant(-cursorOffset, referralIndex),
          daysInStage,
        });
      });
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function report(workers: GeneratedWorker[], plan: Plan): void {
  const total = workers.length;

  const tierCounts = [1, 2, 3, 4].map(
    (tier) => workers.filter((w) => w.result.tier === tier).length,
  );
  const baseCounts = [1, 2, 3, 4].map(
    (tier) => workers.filter((w) => w.result.baseTier === tier).length,
  );

  const pct = (n: number): string => `${((n / total) * 100).toFixed(1)}%`.padStart(6);
  const bar = (n: number): string => '█'.repeat(Math.round((n / total) * 50));

  console.log(`\nCohort: ${total} synthetic workers across ${DISTRICTS.length} districts\n`);
  console.log('Tier distribution (after escalation):');
  for (const tier of [1, 2, 3, 4]) {
    const count = tierCounts[tier - 1] ?? 0;
    const label = ['Low', 'Moderate', 'High', 'Priority'][tier - 1] ?? '';
    console.log(
      `  Tier ${tier} ${label.padEnd(9)} ${String(count).padStart(4)}  ${pct(count)}  ${bar(count)}`,
    );
  }

  console.log('\nBase tier (exposure alone, before escalation):');
  for (const tier of [1, 2, 3, 4]) {
    const count = baseCounts[tier - 1] ?? 0;
    console.log(`  Tier ${tier}${String(count).padStart(6)}  ${pct(count)}`);
  }

  // Counterfactual for the unresolved ESCALATION_MAX_STEPS decision
  // (RISK_MODEL.md §7.1). The cohort is the evidence for that call, so the
  // seed reports it rather than leaving it to be discovered later.
  const singleBump = [1, 2, 3, 4].map(
    (tier) =>
      workers.filter(
        (w) => Math.min(4, w.result.baseTier + Math.min(w.result.escalations.length, 1)) === tier,
      ).length,
  );
  console.log('\nCounterfactual — if ESCALATION_MAX_STEPS were 1 (single bump):');
  for (const tier of [1, 2, 3, 4]) {
    const count = singleBump[tier - 1] ?? 0;
    const actual = tierCounts[tier - 1] ?? 0;
    const delta = count - actual;
    const arrow = delta === 0 ? '' : delta > 0 ? ` (+${delta})` : ` (${delta})`;
    console.log(`  Tier ${tier}${String(count).padStart(6)}  ${pct(count)}${arrow}`);
  }

  const escalated = workers.filter((w) => w.result.tier > w.result.baseTier).length;
  const incomplete = workers.filter((w) => w.result.insufficientData).length;
  const exposures = workers.map((w) => w.result.cumulativeExposure).sort((a, b) => a - b);
  const median = exposures[Math.floor(exposures.length / 2)] ?? 0;
  const p90 = exposures[Math.floor(exposures.length * 0.9)] ?? 0;

  console.log(`\n  escalated above base tier   ${escalated} (${pct(escalated).trim()})`);
  console.log(`  incomplete interviews       ${incomplete} (${pct(incomplete).trim()})`);
  console.log(`  median cumulative exposure  ${median.toFixed(2)} mg/m³·years`);
  console.log(`  p90 cumulative exposure     ${p90.toFixed(2)} mg/m³·years`);
  console.log(`  max cumulative exposure     ${(exposures[exposures.length - 1] ?? 0).toFixed(2)}`);

  console.log('\nBy district:');
  for (const district of DISTRICTS) {
    const inDistrict = workers.filter((w) => w.district === district.name);
    const priority = inDistrict.filter((w) => w.result.tier === 4).length;
    console.log(
      `  ${district.name.padEnd(9)} ${String(inDistrict.length).padStart(4)} workers   ` +
        `tier 4: ${String(priority).padStart(3)} (${((priority / inDistrict.length) * 100).toFixed(1)}%)`,
    );
  }

  console.log('\nOperational records:');
  console.log(`  camps              ${plan.camps.length}`);
  console.log(`  camp invitations   ${plan.invites.length}`);
  console.log(`  attended           ${plan.invites.filter((i) => i.attended).length}`);
  console.log(`  screening events   ${plan.screenings.length}`);
  console.log(`  referrals          ${plan.referrals.length}`);
  console.log(`  stage transitions  ${plan.stageEvents.length}`);

  const byStatus = new Map<string, number>();
  for (const referral of plan.referrals) {
    byStatus.set(referral.status, (byStatus.get(referral.status) ?? 0) + 1);
  }
  console.log('\nReferral pipeline:');
  const ordered = [...REFERRAL_STAGES, 'REJECTED_NO_SYMPTOMS', 'REJECTED_POST_XRAY', 'LOST_TO_FOLLOWUP'];
  for (const stage of ordered) {
    const count = byStatus.get(stage) ?? 0;
    if (count === 0) continue;
    const share = ((count / plan.referrals.length) * 100).toFixed(1);
    console.log(`  ${stage.padEnd(22)} ${String(count).padStart(4)}  ${share.padStart(5)}%`);
  }

  const stalled = plan.referrals.filter(
    (r) => r.daysInStage > 14 && !r.status.startsWith('REJECTED') && r.status !== 'LOST_TO_FOLLOWUP',
  ).length;
  console.log(`\n  stalled >14 days in stage   ${stalled}`);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function write(workers: GeneratedWorker[], plan: Plan): Promise<void> {
  try {
    // Order matters: children before parents. Cascades would handle most of
    // this, but being explicit keeps the script readable and re-runnable.
    await prisma.referralStageEvent.deleteMany();
    await prisma.referral.deleteMany();
    await prisma.screeningEvent.deleteMany();
    await prisma.campInvite.deleteMany();
    await prisma.camp.deleteMany();
    await prisma.riskAssessment.deleteMany();
    await prisma.exposureSegment.deleteMany();
    await prisma.worker.deleteMany();

    await prisma.worker.createMany({
      data: workers.map((w) => ({
        workerId: w.workerId,
        name: w.name,
        age: w.age,
        sex: w.sex,
        district: w.district,
        block: w.block,
        village: w.village,
        phone: w.phone,
        smokingStatus: w.smokingStatus,
        priorTB: w.priorTB,
        createdBy: w.createdBy,
        createdAt: w.createdAt,
      })),
    });

    await prisma.exposureSegment.createMany({
      data: workers.flatMap((w, workerIndex) =>
        w.segments.map((segment, segmentIndex) => ({
          id: `SEG-${String(workerIndex + 1).padStart(5, '0')}-${segmentIndex + 1}`,
          workerId: w.workerId,
          taskCode: segment.taskCode,
          material: segment.material,
          method: segment.method,
          enclosure: segment.enclosure,
          ppeUse: segment.ppeUse,
          siteType: segment.siteType,
          startYear: segment.startYear,
          endYear: segment.endYear,
          monthsPerYear: segment.monthsPerYear,
          hoursPerDay: segment.hoursPerDay,
          siteName: segment.siteName,
        })),
      ),
    });

    await prisma.riskAssessment.createMany({
      data: workers.map((w, index) => ({
        id: `RA-${String(index + 1).padStart(5, '0')}`,
        workerId: w.workerId,
        cumulativeExposure: w.result.cumulativeExposure,
        peakIntensity: w.result.peakIntensity,
        yearsSinceFirstExposure: w.result.yearsSinceFirstExposure,
        baseTier: w.result.baseTier,
        tier: w.result.tier,
        escalationsJson: JSON.stringify(w.result.escalations),
        rescreenMonths: w.result.rescreenMonths,
        topContributorsJson: JSON.stringify(w.result.topContributors),
        reasonEn: w.result.reasonEn,
        reasonHi: w.result.reasonHi,
        insufficientData: w.result.insufficientData,
        modelVersion: w.result.modelVersion,
        jemVersion: w.result.jemVersion,
        confidence: w.result.confidence,
        computedAt: `${REFERENCE_DATE}T06:00:00Z`,
        isCurrent: true,
      })),
    });

    await prisma.camp.createMany({ data: plan.camps });
    await prisma.campInvite.createMany({ data: plan.invites });
    await prisma.screeningEvent.createMany({ data: plan.screenings });
    await prisma.referral.createMany({ data: plan.referrals });
    await prisma.referralStageEvent.createMany({ data: plan.stageEvents });
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const workers = buildCohort();
  const plan = planOperations(workers);

  report(workers, plan);

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.\n');
    return;
  }

  await write(workers, plan);
  console.log('\nSeed complete. All records are synthetic.\n');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
