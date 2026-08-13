# CLAUDE.md — SilicoTrack

Context for Claude Code. Read this before touching anything.

---

## 1. What this is

SilicoTrack is a **risk-targeting and referral-integrity system** for silicosis case-finding in Rajasthan's sandstone mining belt. Built as a solo submission to the iStart Rajasthan Innovation Challenge (student track), problem statement _"Early Detection & Screening Tech for Occupational Lung Disease (Silicosis)."_

Built by one student. Deadline for a demonstrable prototype: **31 August 2026.**

### The thesis, in three lines

1. Rajasthan's screening pipeline rejects **57.6%** of applicants at CHC level for having **no symptoms** — in a disease that is asymptomatic in exactly the stage worth catching.
2. Chest X-ray is only **~48% sensitive** for early silicosis against HRCT. That is photon physics. No model fixes it.
3. Test accuracy is therefore capped, so the remaining lever is **who gets tested**. Cumulative silica exposure is the only predictor available before pathology exists.

**SilicoTrack replaces the symptom gate with an exposure gate.** It does not read X-rays. It decides who should get one, and tracks whether they actually did.

---

## 2. Hard rules — do not violate these

These are not style preferences. Breaking them makes the project indefensible in a government technical review.

1. **Never output a diagnosis.** Not "likely silicosis", not "positive", not a probability of disease. The system outputs an **exposure risk tier** and a **screening recommendation**. The District Pneumoconiosis Board holds sole certification authority. Every screen carries this disclaimer.
2. **Never claim clinical validation.** The system is unvalidated. UI and README say so explicitly.
3. **Every numeric coefficient carries provenance.** Any exposure intensity, control modifier, or threshold must have a `source` and `confidence` field. If a number was estimated rather than sourced, it is marked `PROVISIONAL` and surfaced as such in the UI. **Do not invent numbers and leave them looking authoritative.**
4. **Synthetic data only.** No real patient data, ever, in this repo. Seed data is generated and labelled as such.
5. **No Aadhaar numbers, real or fake-but-plausible.** Use an opaque `workerId`. The production design links via Jan Aadhaar; the prototype does not implement it.
6. **No PII in logs, commits, or error messages.**
7. **Offline-first is a core claim, not a nice-to-have.** The field registry must function with no network and sync later.

---

## 3. Stack

Chosen for solo speed and zero deployment friction. Do not add dependencies without asking.

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** + **shadcn/ui**
- **SQLite** via **Prisma** (production path is Postgres on Rajasthan State Data Centre — keep queries portable, no SQLite-only SQL)
- **Zod** for all input validation
- **Vitest** for tests
- **PWA** (service worker + IndexedDB outbox) for the field app

Everything in one Next.js app. No microservices. No auth provider — use a simple role switcher for the demo and note it.

---

## 4. Architecture

```
src/
  app/
    field/        Registry + exposure interview  (ASHA / ANM / CHO)
    camp/         Prioritised screening lists    (District TB Officer)
    referral/     Referral queue + tracking      (DPB coordinator)
    dashboard/    District surveillance          (DSAP / DoIT&C)
    api/
  lib/
    risk/         ← THE SCIENTIFIC CORE. Pure functions. Heavily tested.
      jem.ts          Job-Exposure Matrix data + lookup
      engine.ts       Cumulative exposure + tiering
      explain.ts      Human-readable reason strings (EN + HI)
      types.ts
    db/
    sync/         Offline outbox + conflict resolution
  components/
prisma/
  schema.prisma
  seed.ts         Synthetic workers across 4 districts
docs/
  RISK_MODEL.md   Model spec + every citation
  JEM_SOURCES.md  Provenance for every exposure value
```

---

## 5. Data model (core entities)

```
Worker           workerId, name, age, sex, district, block, village,
                 phone, smokingStatus, priorTB, createdBy, createdAt

ExposureSegment  workerId, taskCode, material, method (wet|dry),
                 enclosure, ppeUse, startYear, endYear|null,
                 monthsPerYear, hoursPerDay, siteType, siteName|null
                 ── a worker has MANY of these; this is the ledger

RiskAssessment   workerId, cumulativeExposure, peakIntensity,
                 yearsSinceFirstExposure, tier, rescreenMonths,
                 escalations[], modelVersion, computedAt

ScreeningEvent   workerId, campId, date, modality, outcome,
                 aiFlag|null, radiologistRead|null

Referral         workerId, toBoard, status, slotDate,
                 stageHistory[], lastContactAt, daysInStage

Camp             campId, district, block, date, deviceId, capacity,
                 invitedWorkerIds[], attendedWorkerIds[]
```

`Referral.status` must mirror the real Raj Silicosis portal stages so the mapping is honest:
`REGISTERED → PRIMARY_CHECKUP → RADIOGRAPHER → RADIOLOGIST → MO_APPROVAL → BOARD → CERTIFIED → DISBURSED`
plus terminal states `REJECTED_NO_SYMPTOMS`, `REJECTED_POST_XRAY`, `LOST_TO_FOLLOWUP`.

**Measuring drop-off at each of these stages is a headline feature.** The state tracks these internally but does not report them.

---

## 6. The risk engine — build this first, test it hardest

Everything else is CRUD. This is the part that is actually novel, and the part a technical panel will interrogate.

### Cumulative exposure

```
CE = Σ over segments of ( I_task × M_controls × duration_years )
```

Units: **mg/m³·years** of respirable crystalline silica.

- `I_task` — baseline intensity from the JEM
- `M_controls` — product of control modifiers (wet method, enclosure, PPE, indoor/outdoor)
- `duration_years` — calendar years × (monthsPerYear/12) × (hoursPerDay/8)

Also compute:

- `peakIntensity` = max(I_task × M_controls) across all segments
- `yearsSinceFirstExposure` (TSFE) — matters independently; silicosis progresses after exposure stops

### Tiering (v1 — anchored on published dose-response)

| Cumulative exposure | Tier | Label    | Rescreen  |
| ------------------- | ---- | -------- | --------- |
| < 1.0               | 1    | Low      | 60 months |
| 1.0 – 2.0           | 2    | Moderate | 36 months |
| 2.0 – 4.0           | 3    | High     | 24 months |
| ≥ 4.0               | 4    | Priority | 12 months |

**Anchors, and cite these in `docs/RISK_MODEL.md`:** silicosis risk rises consistently above roughly **1 mg/m³·years** cumulative RCS; **4 mg/m³·years** ≈ 40 years at 0.1 mg/m³, the reference point at which pooled cumulative risk estimates run ~42% unadjusted and higher once corrected for chest X-ray insensitivity.

### Escalation rules — bump one tier, cap at 4, never de-escalate

- `priorTB === true`
- `TSFE >= 15` (latency)
- `peakIntensity >= 0.5` (peak matters separately from cumulative dose)
- `smokingStatus === 'current'`

### Output contract

```ts
interface RiskResult {
  cumulativeExposure: number; // mg/m³·years, 2dp
  peakIntensity: number;
  yearsSinceFirstExposure: number;
  baseTier: 1 | 2 | 3 | 4;
  tier: 1 | 2 | 3 | 4; // after escalation
  escalations: EscalationReason[];
  rescreenMonths: number;
  topContributors: {
    // explainability — required
    taskCode: string;
    contribution: number;
    percentOfTotal: number;
  }[];
  reasonEn: string;
  reasonHi: string;
  modelVersion: string;
  confidence: "provisional"; // hardcoded until validated
}
```

**Explainability is not optional.** A health worker must be able to see _why_ a worker was flagged. "Because 68% of this worker's exposure came from 12 years of dry drilling" is the output that makes the system trustworthy.

### Testing requirements

- `engine.ts` must be **pure** — no DB, no dates from `Date.now()`, no I/O. Pass a reference date in.
- Minimum test coverage: boundary cases at each threshold, zero-segment worker, single-segment worker, overlapping segments, ongoing segment (`endYear: null`), every escalation rule in isolation and in combination, escalation cap at tier 4.
- Add a **golden-file test**: 20 fixed worker profiles with expected outputs. Any model change that alters these must be deliberate.

---

## 7. The Job-Exposure Matrix — read this carefully

`lib/risk/jem.ts` assigns a respirable silica intensity to each sandstone task: drilling, dressing, carving, crushing, loading, hauling, and so on.

**A validated Rajasthan sandstone JEM does not exist in published form. This is the single biggest technical risk in the project and also its main contribution.**

Therefore:

```ts
interface JemEntry {
  taskCode: string;
  labelEn: string;
  labelHi: string;
  intensityMgM3: number; // point estimate
  rangeLow: number;
  rangeHigh: number;
  source: string; // citation, or "PROVISIONAL — expert estimate pending validation"
  confidence: "high" | "medium" | "low" | "provisional";
  lastReviewed: string;
}
```

Rules:

- Seed with plausible values from published RCS measurement ranges for analogous tasks, **every one marked `provisional` until a real source is attached.**
- The UI must display a persistent notice wherever a risk score appears: _"Exposure coefficients are provisional and pending field validation."_
- `docs/JEM_SOURCES.md` tracks provenance per entry. Update it whenever a value changes.
- Build a small admin screen to edit JEM values and see the effect on the cohort. This turns the weakness into a demonstrated feature: the model is auditable and updatable by domain experts, not a black box.

**Do not quietly harden provisional numbers into confident ones.** The honesty here is a scored asset, not a liability.

---

## 8. Screens — build in this order

1. **`/field`** — offline-first exposure interview. Large touch targets, Hindi-first labels, works on a cheap Android phone in sunlight. Target: 6 minutes per worker. This is the screen that must feel real.
2. **`/camp`** — DTO view. Given a district, block, and camp capacity of N, output the top N workers by risk tier, geo-clustered to minimise travel. Show projected yield vs. an unselected cohort — this is the money slide.
3. **`/referral`** — stage-by-stage tracker. Highlight workers stalled >14 days. Drop-off funnel.
4. **`/dashboard`** — district surveillance. Funnel chart across all portal stages, tier distribution, asymptomatic-detection rate.

### UI direction

Government field tool, not a startup landing page. Deliberately plain: high contrast for outdoor screen use, generous tap targets, no decorative motion, works at 360px width. Devanagari-safe font stack. Risk tiers use a sequential scale, **not** a red/green traffic light — this is not a diagnosis and must not look like one.

Do not reach for the default AI aesthetic (cream background, serif display, terracotta accent). Ground it in the subject: this is a dust-and-sunlight tool used by an ASHA worker standing in a quarry.

---

## 9. Conventions

- TypeScript strict. No `any`. No non-null assertions without a comment.
- Zod schema at every boundary — form input, API route, sync payload.
- Server Components by default; `'use client'` only where interaction demands it.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`).
- All user-facing strings through `lib/i18n` — English and Hindi from day one, not retrofitted.
- Dates as ISO strings in the DB. Never construct a `Date` from a bare year without UTC.
- Comment the _why_, not the _what_. Especially in `lib/risk`.

---

## 10. Out of scope — do not build these

Say no if asked. Scope creep kills this timeline.

- Any chest X-ray classifier or image model
- Real Raj Silicosis portal integration (no API access exists — build against a documented mock)
- Aadhaar / Jan Aadhaar integration
- Real authentication (demo role switcher only)
- Native mobile app (PWA only)
- Spirometry, breath analysis, biomarkers — roadmap, not build
- Anything requiring CDSCO or AERB clearance

---

## 11. What the demo must show

The end product is a **90-second video**. Reverse-engineer from that.

1. ASHA worker registers a mine worker in the field, offline. Phone in airplane mode.
2. Risk score computes locally. Tier 4, with the reason visible: _"Priority — 4.8 mg/m³·years, mainly 12 years of dry drilling. No symptoms reported."_
3. Network returns; record syncs.
4. DTO opens camp planning. That worker is #3 on tomorrow's list of 40, clustered by village.
5. Dashboard: this cohort's projected yield vs. current self-registration baseline.
6. Referral tracker: two workers stalled 21 days between radiologist and MO. Flagged.

**The narrative beat that matters:** the worker in step 2 has no symptoms and would have been rejected at CHC under the current criterion.

---

## 12. Glossary

- **CHC** — Community Health Centre. Where 57.6% of applicants are currently rejected.
- **DPB** — District Pneumoconiosis Board. Sole certifying authority.
- **DSAP** — Directorate of Specially Abled Persons, Dept. of Social Justice & Empowerment. Owns silicosis policy.
- **DoIT&C** — Dept. of Information Technology & Communication. Issues the work order.
- **RCS** — Respirable crystalline silica.
- **ILO classification** — International Labour Organization system for grading pneumoconiosis radiographs. Categories 0–3.
- **PMF** — Progressive massive fibrosis. Advanced, coalesced disease.
- **STB** — Silicotuberculosis. Silicosis and TB together; mechanistically linked because silica disables the macrophages that contain TB.
- **NTEP** — National TB Elimination Programme. Owns the handheld X-ray units already in Jaipur II and Udaipur.
- **JEM** — Job-Exposure Matrix.
- **TSFE** — Time since first exposure.
