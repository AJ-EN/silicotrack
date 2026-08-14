# SilicoTrack

**Exposure-based risk targeting and referral tracking for silicosis case-finding in Rajasthan.**

Submitted to the iStart Rajasthan Innovation Challenge — *Early Detection & Screening Tech for Occupational Lung Disease (Silicosis)*.

**Live demo: [silicotrack.vercel.app](https://silicotrack.vercel.app)**

> **Status: unvalidated prototype.** Runs on synthetic data. Not clinically validated, not a medical device. It does not diagnose. Everything visible in the live demo is generated — no real worker, quarry, camp or board decision is represented. See [Honest status](#honest-status).

---

## The problem

Rajasthan has the highest silicosis burden in India — prevalence reaching 78.5% among sandstone mine workers in Karauli, 37.3% in Jodhpur. The state has a genuinely leading policy framework: the 2019 Pneumoconiosis Policy, a certification portal, ₹3 lakh compensation, and a pension.

The pipeline still fails, and it fails at a specific place.

**Of 21,871 applications on the state portal, 11,288 — 57.6% — were rejected at Community Health Centre level for a lack of symptoms.** Only 8,312 ever reached a District Pneumoconiosis Board.

The challenge statement itself says early-stage silicosis produces no symptoms until damage is advanced.

**The screening criterion selects against the condition it is trying to find.**

### Why more X-rays is not the fix

Chest X-ray has approximately **48% sensitivity** for early silicosis when measured against HRCT (Hoy et al., *Respirology*, 2024; specificity 97%). Eighteen percent of workers graded ILO category 0 — "normal" — had disease on CT. Queensland's programme found 43% of confirmed cases had a normal radiograph.

This is a limit of projection radiography, not of interpretation. Software cannot recover information the image never contained.

### What follows

If test accuracy is capped, the remaining lever is **selection**. A test with fixed sensitivity and specificity behaves very differently depending on the prevalence of the group it is pointed at. Choosing *who* gets screened moves outcomes more than choosing *what* they are screened with.

Cumulative silica exposure is the only strong predictor available before pathology exists, and it is quantitatively grounded: silicosis risk rises consistently above roughly **1 mg/m³·years** of cumulative respirable crystalline silica.

Every input needed is obtainable in a six-minute structured interview by a health worker with a phone. No device. No radiation. No clinician.

---

## What SilicoTrack does

Four modules, layered on infrastructure Rajasthan already owns.

### 1. Worker exposure registry
Person-linked rather than employer-linked, so the record survives migration between unregistered quarries. Each worker carries a longitudinal ledger of exposure segments: task, material, wet or dry method, enclosure, PPE, duration, site. Offline-first — the field app works with no network and syncs later.

This also addresses a documented compensation barrier: claims currently require a mine licence number and owner's name that migrant workers cannot produce.

### 2. Risk-scoring engine
Computes cumulative respirable silica exposure from the ledger using a Rajasthan sandstone Job-Exposure Matrix, plus peak intensity and time since first exposure as separate terms. Outputs a risk tier, a re-screening interval, and an explanation naming the segments that drove the score.

**This replaces the symptom question as the pipeline gate.**

### 3. Camp orchestration
Converts risk tiers into prioritised, geo-clustered call lists for the ultraportable handheld X-ray units already deployed under the National TB Elimination Programme in Jaipur II and Udaipur — AERB-licensed and radiographer-staffed. No new hardware. No new regulatory pathway.

### 4. Referral closed loop
Tracks every worker across the eight stages the state portal already models internally, from registration through certification to disbursement, and flags drop-off. The state records these stages but does not report loss at each one.

---

## What it deliberately does not do

- **It does not read X-rays.** Rajasthan deployed a deep-learning chest X-ray application on the Raj Silicosis Portal at District Pneumoconiosis Board level in October 2023. SilicoTrack routes cases *into* that system, not around it.
- **It does not diagnose.** Output is an exposure risk tier and a screening recommendation. Certification authority remains entirely with the District Pneumoconiosis Board.
- **It does not use imported TB CAD.** Published evaluation of qXR in a triage cohort recorded 0.32 specificity, and 2025 analysis of 2,000 chest X-rays from silica-exposed Southern African mineworkers documented CAD bias in this exact population.

---

## Quickstart

Postgres everywhere — the same engine locally and deployed, so a query that
works on your machine works on the deployed app.

```bash
git clone <repo> && cd silicotrack
npm install
cp .env.example .env

npx prisma dev --detach   # local Postgres; prints a connection string
# paste that string into .env as DATABASE_URL

npx prisma migrate deploy
npm run seed              # ~500 synthetic workers across 4 districts
npm run dev               # http://localhost:3000
```

Tests:

```bash
npm run db:test:setup     # one-off: isolated schema, prints TEST_DATABASE_URL
npm test                  # 215 tests
```

`npm run db:test:setup` exists because the database tests truncate every table
between cases. They run against a dedicated `silicotrack_test` schema and
refuse to start against `public`, so `npm test` can never destroy your seeded
cohort. Without `TEST_DATABASE_URL` set, the 9 database tests skip and the
other 206 still run.

**Demo routes** — role switcher in the header, no auth:

| Route | Role |
|---|---|
| `/field` | ASHA / ANM / CHO — exposure interview |
| `/camp` | District TB Officer — screening priority lists |
| `/referral` | DPB coordinator — referral tracking |
| `/dashboard` | DSAP / DoIT&C — district surveillance |

---

## Project structure

```
src/lib/risk/       Risk engine — pure functions, the scientific core
src/app/            Four role-specific interfaces
prisma/seed.ts      Synthetic data generator
docs/RISK_MODEL.md  Model specification and citations
docs/JEM_SOURCES.md Provenance for every exposure coefficient
```

---

## Honest status

Stated plainly, because a government evaluator will find out anyway and because it is true.

| | |
|---|---|
| Clinical validation | **None.** No real patient has been screened. |
| Data | **Synthetic.** Generated, labelled as such. No real records. |
| Job-Exposure Matrix | **Provisional.** A validated Rajasthan sandstone JEM does not exist in published form. Coefficients are estimates from analogous published RCS ranges, flagged `provisional` in code and surfaced in the UI. Building a real one is the main technical contribution and the main technical risk. |
| Portal integration | **Mocked.** No API access exists. Built against a documented mock of the published portal stages. |
| Authentication | **Demo only.** Role switcher, not real auth. |
| Regulatory | Advisory system, no diagnostic claim. Production deployment would require CERT-In empanelled security audit and DPDP Act 2023 compliance. |

The Job-Exposure Matrix is editable through an admin screen so its effect on the cohort is visible and auditable. That is the design response to its provisional status: not to hide the uncertainty, but to make it inspectable and correctable by domain experts.

---

## Roadmap beyond the prototype

1. Build and field-validate the Rajasthan sandstone JEM through expert elicitation and district dust measurement.
2. Retrospectively validate risk tiers against certified cases already in the state portal.
3. Silicosis / TB / silicotuberculosis field routing, trained on SilicoData (IIT Jodhpur, 3,044 annotated chest X-rays from Rajasthan stone workers).
4. Evaluate pre-radiographic biomarkers — ICMR-NIOH's CC16 point-of-care lateral-flow assay is the strongest Indian candidate.
5. Low-dose HRCT as reference standard for a validation sub-study.

---

## Key sources

- Rajasthan Policy on Pneumoconiosis, 2019 — Dept. of Social Justice & Empowerment
- Raj Silicosis Portal — `rajsilicosis.rajasthan.gov.in`
- Pipeline rejection data — *Challenges in the Implementation of the Rajasthan Pneumoconiosis Policy*, Annals of Work Exposures and Health, 2022
- CXR sensitivity — Hoy et al., *Respirology*, 2024
- Exposure–response — dose-response meta-analysis of cumulative RCS exposure and silicosis, 2024
- Spirometry in early ILO grades — S.N. Medical College, Jodhpur (ERS, 2015)
- Handheld X-ray deployment — Central TB Division operational guide, Aug 2023
- SilicoData — Akhter et al., *Nature Scientific Data*, 2025

---

Built by one student, in public, with the state's own published numbers.