# RISK_MODEL.md — SilicoTrack Cumulative Exposure Model

**Model version:** `risk-model-0.1.0`
**Status:** Provisional. Unvalidated. No clinical validation has been performed.
**Last reviewed:** 2026-08-13

---

## 0. How to read this document

Every numeric value in this specification carries a provenance tag. There are four:

| Tag | Meaning |
|---|---|
| **`[LIT]`** | Taken directly from a cited peer-reviewed source. The citation is given inline and in §12. |
| **`[DERIVED]`** | Arithmetic consequence of a `[LIT]` value. No independent judgement added. |
| **`[CAL]`** | **Author's calibration choice.** No literature value exists for this number. It is a judgement call, and a reviewer may reasonably disagree with it. |
| **`[PROVISIONAL]`** | Placeholder with no source at all, pending field validation. Must be surfaced as provisional in the UI. |

`[CAL]` and `[PROVISIONAL]` values are the honest weak points of this model. They are marked rather than hidden. A technical reviewer should be able to find every one of them by searching this file for the tag.

To audit provenance coverage, grep this file for each tag:

```bash
for t in LIT DERIVED CAL PROVISIONAL; do
  printf "%-12s %s\n" "$t" "$(grep -o "\[$t\]" docs/RISK_MODEL.md | wc -l)"
done
```

No summary count is stated here on purpose — a hardcoded tally drifts out of date on the first edit, and a stale provenance count in a document about provenance discipline would be worse than none.

**The short version: the only `[LIT]` numbers in this model are the tier-4 anchor at 4.0 mg/m³·years, the measured Rajasthan sandstone intensity of 0.12 mg/m³, the regulatory limits, and the epidemiological figures used to justify escalation rules. Everything else — every control modifier, every rescreen interval, two of the three tier boundaries, and the peak-intensity threshold — is a judgement call.**

---

## 1. What this model claims, and what it does not

### It claims

That **cumulative respirable crystalline silica (RCS) exposure, reconstructed from an occupational history, is a better gate for allocating scarce chest radiography than the presence of symptoms.**

That claim rests on three propositions, each independently sourced:

1. Silicosis risk has a strong, monotonic dose-response relationship with cumulative RCS exposure. `[LIT]` — Howlett et al., *Thorax* 2024.
2. Chest radiography is insensitive to early silicosis, so radiographic screening cannot be the first-line selector. `[LIT]` — Hoy et al., *Respirology* 2024.
3. Early silicosis is asymptomatic, so symptoms cannot be the selector either. This is stated in the challenge problem statement itself and is the basis of the 57.6% CHC rejection figure.

### It explicitly does not claim

- **It does not diagnose.** The output is an exposure tier and a screening recommendation. It is not a probability of disease, not a likelihood of silicosis, and must never be rendered as one.
- **It does not estimate individual risk.** The dose-response literature it draws on is cohort-level. Applying a cohort curve to an individual is not valid inference and this model does not attempt it. Tiers are a **ranking device for triage**, not a personal risk estimate.
- **It is not calibrated.** No worker scored by this model has been followed to a radiographic outcome. Tier boundaries are anchored to literature but the resulting cohort distribution is unverified.
- **The certification authority is the District Pneumoconiosis Board.** Always. Every output carries this.

> **Design consequence:** because tiers are a ranking device rather than a risk estimate, the model is allowed to be miscalibrated in absolute terms so long as it *orders* workers usefully. Ordering is what a capacity-constrained screening camp actually needs. This is the weakest defensible claim that still supports the product, and it is deliberately the one being made.

---

## 2. Notation and units

| Symbol | Meaning | Unit |
|---|---|---|
| `I_task` | Baseline respirable crystalline silica intensity for a task | mg/m³ |
| `M_controls` | Dimensionless product of control modifiers | — |
| `D` | Duration of a segment, normalised to full-time equivalent | years |
| `CE` | Cumulative exposure | mg/m³·years |
| `P` | Peak intensity | mg/m³ |
| `TSFE` | Time since first exposure | years |

**All exposures are respirable crystalline silica**, not respirable dust. These differ by roughly 4× in Rajasthan sandstone — mean respirable dust 0.47 mg/m³ against mean RCS 0.12 mg/m³ `[LIT]` (Prajapati et al. 2020). Conflating the two would inflate every score by a factor of four. Any JEM entry sourced from a dust measurement must be silica-fraction-corrected before entry, and the correction recorded in `JEM_SOURCES.md`.

**Reference concentrations for orientation:**

| Standard | Limit (mg/m³ RCS) | Source |
|---|---|---|
| India DGMS | 0.15 | `[LIT]` Prajapati et al. 2020 |
| OSHA PEL / NIOSH REL | 0.05 | `[LIT]` cited in Prajapati et al. 2020 |
| ACGIH TLV | 0.025 | `[LIT]` cited in Prajapati et al. 2020 |
| Rajasthan sandstone mine, measured mean | 0.12 | `[LIT]` Prajapati et al. 2020 |

The Indian standard is three to six times more permissive than international limits — the authors of the measurement study say so explicitly and call for revision. **This matters for the model:** a worker can be legally compliant under DGMS and still accumulate tier-4 exposure. The model must not treat the Indian PEL as a safety threshold.

---

## 3. The core equation

```
CE = Σ over segments s of ( I_task(s) × M_controls(s) × D(s) )
```

### 3.1 Duration term

```
D = (endYear − startYear + 1) × (monthsPerYear / 12) × (hoursPerDay / 8)
```

- `endYear` is `startYear` inclusive, hence `+ 1`: a worker who worked only in 2019 has one year of exposure, not zero. `[CAL]`
- If `endYear` is `null` (ongoing), substitute the year of the **reference date passed into the engine**. The engine must never read the system clock — see §9.
- Normalised to an 8-hour day and 12-month year, so `D` is full-time-equivalent years.

**`hoursPerDay` is capped at 12 `[CAL]`.** Uncapped, a self-reported 16-hour day yields a 2.0× multiplier on top of an already uncertain intensity, and self-reported extreme hours are the least reliable field in the interview. The cap bounds the damage. Recorded hours above 12 are stored verbatim but clamped at computation time, and the clamp is surfaced in the assessment record.

### 3.2 Overlapping segments

Workers commonly report concurrent roles — quarrying in season and dressing stone the rest of the year. Naive summation double-counts calendar time.

**Rule `[CAL]`:** segments are summed independently, but where two segments overlap in calendar years, the engine sums each segment's **calendar occupancy** (`monthsPerYear / 12`) for that year and, if the total exceeds 1.0, scales each contributing segment's occupancy proportionally so the year sums to 1.0.

Rationale: a person cannot work more than twelve months in a year. Without this, a worker reporting three concurrent seasonal tasks accumulates three years of exposure per calendar year and reaches tier 4 spuriously. This is a modelling choice, not a literature value, and it is the single most consequential piece of arithmetic in the engine that has no external justification.

> **Scaling applies to calendar occupancy, NOT to full FTE.** An earlier draft of this section specified FTE, which is wrong: FTE includes the `hoursPerDay / 8` multiplier, so capping it at 1.0 per year would also cap the day-length term and silently erase the extra exposure of a 12-hour day — the opposite of what that term exists to capture. A person cannot work more than twelve months in a year; they can certainly work more than eight hours in a day. The two limits are different and only the first is a calendar constraint.
>
> Corrected during implementation. Pinned by `preserves the long-day multiplier through overlap scaling` in `engine.test.ts`.

**Consequence to test:** overlapping-segment workers must not score higher than the same person with the same total task-time recorded as sequential segments.

### 3.3 Derived quantities

```
P    = max over segments of ( I_task(s) × M_controls(s) )
TSFE = referenceYear − min over segments of startYear
```

`P` and `TSFE` are computed over **all** segments including ended ones. Silicosis progresses after exposure ceases; a worker who left the quarry in 2010 is not thereby low-risk.

---

## 4. Term 1 — `I_task`, the Job-Exposure Matrix

Task intensities live in `lib/risk/jem.ts` with provenance in `docs/JEM_SOURCES.md`. This section specifies only the **constraint the JEM must satisfy**, not the values.

**A validated Rajasthan sandstone JEM does not exist in published form.** Every entry is `[PROVISIONAL]` until a source is attached. This is the largest technical risk in the project.

### 4.1 The anchoring constraint

The JEM is not free to take arbitrary values. It has one hard external anchor:

> An FTE-weighted average of `I_task` across a realistic Rajasthan sandstone task mix **must reproduce approximately 0.12 mg/m³**, the measured mean RCS for Indian sandstone mines `[LIT]` (Prajapati et al. 2020).

The JEM's job is to *disaggregate* that measured mean into task-level intensities — dry drilling well above it, haulage well below it — not to invent a new level. Any JEM revision that breaks this constraint must be justified in `JEM_SOURCES.md`.

This gives the provisional matrix a defensible centre of mass even while individual entries remain unsourced. It converts "we made up nine numbers" into "we apportioned one measured number across nine tasks, and the apportionment is the uncertain part." That is a materially stronger position in review.

**Caveat `[LIT]` fidelity:** the 0.12 mg/m³ figure is a mean across sampled sandstone mines, not a task-stratified measurement, and the study does not report task-level breakdown. It constrains the JEM's mean, not its spread. The spread is `[PROVISIONAL]` in full.

### 4.2 Task list requiring entries

Derived from the occupational categories reported for Rajasthan sandstone workers `[LIT]` (Rajavel et al. 2020): men predominantly performed stone cutting, drilling, or both (94.5%); women predominantly loading stone and cleaning stone waste (93.4%).

Minimum viable task set — all `[PROVISIONAL]`:

`DRILL_DRY`, `DRILL_WET`, `CUT_DRY`, `CUT_WET`, `DRESS`, `CARVE`, `CRUSH`, `LOAD`, `HAUL`, `CLEAN_WASTE`, `BLAST_ASSIST`, `OTHER`

The sex-segregation of tasks is a real and documented feature of this workforce and should be reflected in seed data, but **sex must never be a model input.** It is a proxy for task, and task is measured directly.

---

## 5. Term 2 — `M_controls`, the control modifiers

```
M_controls = m_method × m_enclosure × m_ppe × m_site
```

All four modifiers are `[PROVISIONAL]`. Proposed placeholder values, **none of which currently has a citation**:

| Modifier | Condition | Value | Tag |
|---|---|---|---|
| `m_method` | `wet` | 0.50 | `[PROVISIONAL]` |
| | `dry` | 1.00 | reference |
| `m_enclosure` | enclosed cab / booth | 0.60 | `[PROVISIONAL]` |
| | open | 1.00 | reference |
| `m_ppe` | consistent respirator use | 0.70 | `[PROVISIONAL]` |
| | intermittent | 0.90 | `[PROVISIONAL]` |
| | none | 1.00 | reference |
| `m_site` | underground / pit | 1.20 | `[PROVISIONAL]` |
| | open surface | 1.00 | reference |

### Constraints on these values

- **Bounded below at 0.25 `[CAL]`.** The product of all four best-case modifiers must not fall below one quarter of baseline. Controls in unregulated small quarries are not the controls measured in engineered-control studies, and a model that lets a worker claim a 90% reduction because they said "yes" to a PPE question is a model that will systematically under-triage the most vulnerable workers.
- **PPE modifiers are deliberately weak `[CAL]`.** Self-reported respirator use is unreliable, fit-testing is absent in this sector, and a 0.70 modifier already credits more protection than field conditions likely deliver. Do not lower these without a field study.
- **`m_ppe` must never reach 0.** No answer in the interview should be able to zero out a worker's exposure.

### Why these are not merely cosmetic

The wet/dry distinction is the single largest controllable factor in the equation and drives the model's principal actionable output — the recommendation that dry drilling be wet-suppressed. Sourcing `m_method` against published dust-suppression efficacy is the **highest-value citation task remaining** and should be prioritised over refining any individual `I_task` value.

---

## 6. Tier thresholds

| CE (mg/m³·years) | Tier | Label | Rescreen |
|---|---|---|---|
| `[0, 1.0)` | 1 | Low | 60 months |
| `[1.0, 2.0)` | 2 | Moderate | 36 months |
| `[2.0, 4.0)` | 3 | High | 24 months |
| `[4.0, ∞)` | 4 | Priority | 12 months |

Intervals are **lower-inclusive, upper-exclusive**. A worker at exactly 2.00 is Tier 3. Comparison happens on the value rounded to 2 decimal places, so that the displayed number and the assigned tier can never disagree — a worker shown "2.00" must not be Tier 2. `[CAL]`

### 6.1 The 4.0 boundary — the strongest anchor

**`[LIT]`.** Howlett et al. (*Thorax* 2024) fixed their reference category at **4 mg/m³·years, equivalent to 40 years at 0.10 mg/m³**. At that reference, pooled absolute silicosis risk among mining cohorts was approximately **420 per 1,000 (42%)**, against 51 per 1,000 (5.1%) in non-mining cohorts. The meta-analysis pooled 8 studies / 10 cohorts, 8,792 silicosis cases among 65,977 participants.

This is the best-supported number in the model. 4.0 marks a point at which, in mining populations, roughly two in five exposed workers show radiographic silicosis.

**Adjusted upward for radiographic insensitivity.** A follow-up preprint by the same group re-estimated the dose-response correcting for CXR's imperfect sensitivity against HRCT. Under a fixed-sensitivity assumption they estimated CXR sensitivity at **0.76 (95% CI 0.63–0.86)**, and the 4→2 mg/m³·years absolute risk reduction rose from 323 per 1,000 unadjusted to **409 (fixed) or 557 (relative)** per 1,000. The correction was most pronounced **below approximately 6 mg/m³·years** — that is, precisely in the range this model operates in. `[LIT, PREPRINT]`

**Interpretation for SilicoTrack:** the true risk at 4.0 is likely *higher* than 42%, and the ordering of workers below 6 mg/m³·years is more consequential than unadjusted figures suggest. This strengthens rather than weakens the case for exposure-based triage. It is cited as a **preprint and must be labelled as not peer-reviewed** wherever it appears.

### 6.2 The 1.0 boundary — literature-informed, but a calibration choice

**`[CAL]`, with literature support.** The project brief states that silicosis risk rises consistently above roughly 1 mg/m³·years. Summary treatments of Howlett et al. do describe risk as clearly and consistently increased above approximately this level across most included studies.

**However — stated plainly:** I could not verify a specific quantitative statement in Howlett et al. establishing an inflection point at 1.0. The paper's own framing is built around the 4→2 mg/m³·years contrast, and its dose-response curves are non-linear with steeper slopes at lower cumulative exposures, which implies meaningful risk begins well below 4.0 without pinning where.

**Therefore 1.0 is treated as a calibration choice consistent with the literature, not a literature value.** It is defensible as the lower edge of the range where pooled evidence shows consistent elevation. It should not be presented to a review panel as a published threshold.

**Action:** obtain the full text of Howlett et al. 2024 and either upgrade this to `[LIT]` with a page-level citation, or leave it `[CAL]` and say so in the UI provenance panel.

### 6.3 The 2.0 boundary — pure calibration

**`[CAL]`.** 2.0 is the comparator arm of the meta-analysis's headline contrast (4→2), which makes it a natural and citable *waypoint*, but the meta-analysis does not propose it as a risk threshold. It is used here to split the 1.0–4.0 span into two operationally distinct bands.

Its real justification is operational, and should be stated as such: **it produces a Tier 3 band that is large enough to fill screening camps and small enough to be a meaningful priority signal.** That is a service-delivery rationale, not an epidemiological one.

### 6.4 Coherence check against Rajasthan field data

Not a validation. A sanity check, using two independent published sources.

| Input | Value | Source |
|---|---|---|
| Mean RCS, Indian sandstone mines | 0.12 mg/m³ | `[LIT]` Prajapati et al. 2020 |
| Mean tenure, Jodhpur sandstone workers | 18.88 ± 9.81 years | `[LIT]` Rajavel et al. 2020 |
| Mean tenure among workers *with* silicosis | 26.37 years (range 15–35) | `[LIT]` Rajavel et al. 2020 |
| Observed silicosis prevalence in that cohort | 37.3% | `[LIT]` Rajavel et al. 2020 |

**`[DERIVED]`** — applying the model's arithmetic at the measured mean intensity, with no control modifiers:

- Mean Jodhpur worker: `0.12 × 18.88 ≈ 2.27 mg/m³·years` → **Tier 3**
- Mean silicotic worker: `0.12 × 26.37 ≈ 3.16 mg/m³·years` → **Tier 3**, approaching Tier 4

And the observed silicosis prevalence in the Jodhpur cohort — **37.3%** — sits close to Howlett's pooled mining estimate of **~42% at 4 mg/m³·years**, from an entirely separate literature.

**What this does and does not mean.** It means the model's tier boundaries land in a plausible place for this workforce: a typical long-tenure Jodhpur sandstone worker scores Tier 3, and the population is positioned in the steep part of the dose-response curve. It does **not** mean the model is validated. Specifically:

- 37.3% is cross-sectional prevalence in a convenience sample of 174 workers across 15 mines, not cumulative incidence in a followed cohort. The two are not the same quantity.
- 0.12 mg/m³ is an area mean across sampled mines, not the exposure of the workers Rajavel sampled.
- The agreement of two crude numbers from unrelated studies is **coherence, not confirmation**, and could be coincidence.

It is included because it is the only external reality check currently available, and because a reviewer will do this arithmetic anyway.

---

## 7. Escalation rules

Escalations exist because cumulative dose is not the only determinant of who should be screened first. Each rule below is graded for evidential strength, because they are **not equally well supported and should not be presented as though they were.**

### 7.1 Unresolved specification question — additive or single bump?

The project brief says "bump one tier, cap at 4" while also listing four rules and requiring tests for escalations "in isolation and in combination." These are in tension: if only one bump is ever applied, combination testing and the tier-4 cap are both near-trivial.

**Specified behaviour `[CAL]` — requires sign-off:**

```
tier = min( 4, baseTier + min( 2, count of satisfied escalation rules ) )
```

Escalations are **additive, capped at +2 tiers, and hard-capped at tier 4. The model never de-escalates.**

The +2 sub-cap is the substantive choice. Without it, a worker with `CE = 0.3` who is a current smoker with prior TB and 20 years since first exposure jumps from Tier 1 to Tier 4 — **and the system stops being an exposure gate.** The +2 cap keeps cumulative exposure the dominant term while letting genuine modifiers move a worker meaningfully. A Tier 1 worker can reach Tier 3 on non-exposure grounds but cannot reach Priority.

> **This is a decision the project owner should confirm before the golden-file tests are frozen.** It materially changes the cohort tier distribution and therefore every camp list the system produces.

#### Measured effect on the 500-worker synthetic cohort

Printed by `npm run seed -- --dry-run`. `fired` = condition held; `applied` = claimed one of the limited escalation steps; `sole` = the only rule firing for that worker, which is the closest available read on a rule's marginal effect.

| Rule | fired | applied | sole trigger |
|---|---|---|---|
| `PRIOR_TB` | 45 (9.0%) | 45 (9.0%) | 13 (2.6%) |
| `PEAK_INTENSITY` | **0 (0.0%)** | 0 (0.0%) | 0 (0.0%) |
| `LATENCY` | **267 (53.4%)** | 267 (53.4%) | **187 (37.4%)** |
| `CURRENT_SMOKER` | 117 (23.4%) | 112 (22.4%) | 56 (11.2%) |

Three things follow, and they sharpen the §7.1 decision rather than settling it.

**`LATENCY` is the escalation model.** It fires for over half the cohort and is the sole trigger for 37.4% — more than the other three rules combined. Any argument about escalation policy is, in practice, an argument about this one rule. It is also the rule with the weakest threshold justification (§7.2: 15 years is a tenure floor observed in one cross-sectional study, not a dose-response inflection).

**`PEAK_INTENSITY` fires for nobody**, confirming on a realistic cohort what §7.2 establishes arithmetically: the threshold sits above the matrix ceiling. It is not a weak rule, it is an absent one.

**The +2 cap is nearly irrelevant; the second step is not.** Only 5 workers (1.0%) fire three rules and hit the cap. But 79 (15.8%) fire exactly two and take a full +2. So lowering `ESCALATION_MAX_STEPS` to 1 would not be "tightening an edge case" — it would change the tier of 84 workers, about one in six. The earlier framing of this as a cap question was wrong: it is a question about whether a second escalation should count at all.

### 7.2 The rules

| Rule | Evidence | Grade |
|---|---|---|
| `priorTB === true` | Strong — but causally inverted, see below | `[LIT]`-supported, `[CAL]` application |
| `TSFE >= 15` | Good | `[CAL]`, literature-consistent |
| `peakIntensity >= 0.5` | Mechanism strong, threshold invented | `[CAL]` |
| `smokingStatus === 'current'` | Weak and contested | `[CAL]`, weakest rule |

---

#### `priorTB === true`

**Evidence `[LIT]`.** The silica–TB association is among the best-established findings in this literature. Pooled relative risk of TB with radiological silicosis is **4.01 (95% CI 2.88–5.58)**; for silica exposure controlling for or excluding silicosis, **1.92 (95% CI 1.36–2.73)** (Ehrlich et al.). In the Jodhpur sandstone cohort specifically, silicotuberculosis prevalence was **7.4%** and TB **10.0%** `[LIT]` (Rajavel et al. 2020).

**The honest caveat — the causal arrow points the other way.** Silica exposure disables the alveolar macrophages that contain *M. tuberculosis*, raising TB risk. Prior TB does not cause silicosis. So this rule is **not** a risk factor in the causal sense, and should not be defended as one.

**What it actually is `[CAL]`:** a screening-yield heuristic doing two legitimate jobs — (a) a marker of unmeasured or under-reported silica exposure, since TB in this population is itself partly exposure-driven, and (b) identification of the silicotuberculosis phenotype, where a chest X-ray has high clinical value regardless of the silicosis question.

State it this way in review. A panel member who knows this literature will notice the inverted arrow, and the rule survives the objection only if the framing is right from the start.

---

#### `TSFE >= 15`

**Evidence `[CAL]`, literature-consistent.** Two independent supports:

- Howlett et al. required, as an inclusion criterion, cohorts with mean or median duration since starting work exceeding **20 years**, describing this as a pragmatic balance capturing the increased silicosis risk observed after 20 years `[LIT]`.
- In the Jodhpur cohort, workers with silicosis had a tenure range of **15–35 years**, with the **minimum at 15** `[LIT]` (Rajavel et al. 2020).

The 15-year threshold is set at the observed floor of tenure among silicotic Rajasthan sandstone workers rather than at the meta-analysis's more conservative 20, because this model's purpose is to catch cases *before* they are established. Choosing 15 over 20 is the calibration choice. `[CAL]`

**Specification hazard — TSFE is not tenure.** TSFE is measured from first exposure to the reference date and keeps growing after a worker leaves the industry. The literature values above are *duration of employment*. For a currently-employed worker the two roughly coincide; for a worker who left in 2005 they diverge sharply. This is intentional — silicosis progresses after exposure ceases — but it means the rule is applied slightly outside the sense in which its supporting numbers were measured. Document this; do not paper over it.

---

#### `peakIntensity >= 0.5`

**Mechanism `[LIT]`, threshold `[CAL]`.** That peak intensity matters independently of cumulative dose is well supported. Buchanan, Miller & Soutar (*Occup Environ Med* 2003), reanalysing 371 Scottish colliery workers aged 50–74, found that **1 g·h·m⁻³ of cumulative exposure accrued at quartz concentrations above 2 mg/m³ carried risk equivalent to 3 g·h·m⁻³ accrued at lower concentrations** — roughly a threefold risk premium per unit dose for high-intensity exposure. They also estimated ~20% probability of silicosis after 15 years at a mean 8-hour concentration of 0.3 mg/m³.

This is a genuine and citable justification for a separate peak term. **It does not justify the value 0.5.**

**Buchanan's own inflection is at 2 mg/m³, four times the threshold used here.** The 0.5 figure is a calibration choice with a different rationale:

- ≈ 4× the measured Rajasthan sandstone mean of 0.12 mg/m³ `[LIT]`
- ≈ 3.3× the Indian DGMS permissible limit of 0.15 mg/m³ `[LIT]`
- ≈ 10× the OSHA/NIOSH limit of 0.05 mg/m³ `[LIT]`

So 0.5 marks "substantially above the regulatory limit in the local context" rather than "above the concentration at which Buchanan observed a risk premium." Using Buchanan's 2.0 would, against a JEM centred on 0.12, flag almost nobody and render the rule inert.

> ### ⚠ This rule is currently DEAD CODE. It can never fire.
>
> Established during implementation, not by inspection of this document.
>
> The highest intensity in `jem-raj-sandstone-0.1.0` is `DRILL_DRY` at **0.28 mg/m³**. The largest possible control product is **1.2** (underground, no other controls; every other modifier is ≤ 1.0). The ceiling on `peakIntensity` is therefore:
>
> ```
> 0.28 × 1.2 = 0.336 mg/m³   <   0.5 threshold
> ```
>
> **No worker, doing any task in the matrix, under any combination of interview answers, can trigger this escalation.** It contributes nothing to any tier assignment. All 20 golden profiles confirm it: the highest peak observed across the fixture is 0.28.
>
> This is pinned by two tests — `PEAK_INTENSITY is currently unreachable — known finding` in `engine.test.ts` and `confirms PEAK_INTENSITY never fires` in `golden.test.ts` — which assert **current reality, not desired behaviour**. They will fail the moment either the threshold or the matrix moves, forcing a deliberate decision rather than a silent one.
>
> **Three ways out, all requiring sign-off:**
>
> 1. **Lower the threshold** to ~0.25 mg/m³ — roughly 1.7× the DGMS limit, and reachable by dry drilling and crushing. Keeps the rule's intent, abandons any claim to Buchanan's inflection point.
> 2. **Raise the JEM's high end.** Defensible only if task-stratified measurement supports it; the anchoring constraint (§4.1) caps how far the matrix mean can move, though individual task peaks could rise with compensating falls elsewhere.
> 3. **Delete the rule** and state that peak intensity is not modelled at v1. Honest, and arguably cleanest until a sourced JEM exists.
>
> **Do not leave it as-is silently.** A rule that appears in the specification, appears in the output contract, and never fires is worse than no rule: it implies a safeguard that does not exist.

**This remains the model's most vulnerable single number.** Its rationale is regulatory rather than epidemiological, it is off by 4× from the one published inflection point available, and it is currently inert. It is flagged here so it is found by the project rather than by a reviewer.

---

#### `smokingStatus === 'current'`

**Evidence `[CAL]` — weakest rule in the model, and it should be labelled so.**

The literature is genuinely mixed. Some studies report roughly a doubling of silicosis risk among smokers, statistically significant among men, and one reports an odds ratio of 4.79 for cigarette smoking and silicosis diagnosis. Others find only a weak and statistically non-significant relationship between prolonged smoking and radiographic silicosis. Smoking's established effects in this population — accelerated lung function decline, lung cancer risk, worse prognosis — are largely **not** effects on silicosis incidence.

**Recommendation.** Retain the rule, for two defensible reasons: smokers in this cohort warrant respiratory screening on independent grounds, and smoking status is a cheap interview field. But:

1. Label it explicitly as the lowest-confidence escalation in both the UI provenance panel and `RISK_MODEL.md`.
2. Consider demoting it to a **half-step** — a within-tier priority sort key rather than a tier bump — at the next model revision. It currently has equal weight to prior TB, which the evidence does not support.
3. It must never be described to workers as "smoking causes silicosis." The accurate statement is that smoking worsens outcomes in silica-exposed workers.

---

## 8. Rescreen intervals

| Tier | Interval | Tag |
|---|---|---|
| 1 | 60 months | `[CAL]` |
| 2 | 36 months | `[CAL]` |
| 3 | 24 months | `[CAL]` |
| 4 | 12 months | `[CAL]` |

**All four are calibration choices with no literature backing whatsoever, and this must be stated wherever they appear.**

They encode a defensible monotonic principle — higher exposure warrants more frequent surveillance — but the specific values are operational judgements shaped by screening capacity, not evidence-derived intervals. International surveillance guidance for silica-exposed workers exists and has not yet been reviewed for this project.

**Action before submission:** review ILO and WHO surveillance guidance and any DGMS periodic medical examination requirement for Indian mine workers, and either align these intervals or document why they diverge. As it stands this is the largest block of unsourced numbers in the model outside the JEM itself.

---

## 9. Engine contract and purity requirements

### 9.1 Purity

`engine.ts` **must** be a pure function.

- No database access, no I/O, no network.
- **No `Date.now()`, no `new Date()` with no argument.** The reference date is an explicit parameter. A model whose output changes because a test ran after midnight is not testable, and TSFE depends directly on it.
- No mutation of input segments.
- Deterministic: identical inputs must produce byte-identical output, including the ordering of `topContributors` and `escalations`. Ties in contribution are broken by `taskCode` ascending. `[CAL]`

### 9.2 Output contract

```ts
interface RiskResult {
  cumulativeExposure: number;      // mg/m³·years, 2dp
  peakIntensity: number;           // mg/m³, 2dp
  yearsSinceFirstExposure: number;
  baseTier: 1 | 2 | 3 | 4;
  tier: 1 | 2 | 3 | 4;             // after escalation
  escalations: EscalationReason[];
  rescreenMonths: number;
  topContributors: {
    taskCode: string;
    contribution: number;          // mg/m³·years
    percentOfTotal: number;
    fteYears: number;              // duration_years — what the model multiplies
    calendarYears: number;         // wall-clock years — what a human reads
  }[];
  reasonEn: string;
  reasonHi: string;
  modelVersion: string;
  jemVersion: string;
  confidence: 'provisional';       // hardcoded until validated
  insufficientData: boolean;       // no exposure segments recorded at all
}
```

`baseTier` is retained alongside `tier` so the escalation contribution is always visible and auditable. Never display `tier` without being able to explain the gap.

#### Two year counts, deliberately

`fteYears` and `calendarYears` are both required, and confusing them is a live defect class rather than a hypothetical one.

`fteYears` is the `duration_years` term from §3 — it carries the months-per-year and hours-per-day scaling, so a decade of 12-hour days is **15** FTE years. It is what the model multiplies, and it is meaningless as a statement about a person's life.

`calendarYears` is the count of distinct calendar years in which the task was worked. It is what someone means by "12 years of dry drilling".

> **Reason strings must render `calendarYears`. Never `fteYears`.**
>
> Found by seeding a synthetic cohort: a 45-year career at 12-hour days rendered as *"mainly 67.5 years of polishing"*. Arithmetically correct, and instantly disqualifying to any health worker holding that man's file. Explainability is only worth having if the explanation survives contact with someone who knows the worker.
>
> Pinned by `reports calendar years, never the FTE years the model multiplies` in `explain.test.ts` and `never reports an implausible working life in a reason string` in `golden.test.ts`.

Note also that the two differ by one at the start: a worker who began in 2024, assessed in 2026, has worked three calendar years but has a TSFE of two. Start years are inclusive (§3.1); TSFE measures elapsed time.

### 9.3 Edge cases

| Case | Behaviour | Tag |
|---|---|---|
| Zero segments | See open question below | — |
| Single segment | Normal computation; `topContributors` has one entry at 100% | — |
| `endYear < startYear` | Reject at the Zod boundary, not in the engine | `[CAL]` |
| `endYear` in the future relative to reference date | Clamp to reference year | `[CAL]` |
| `startYear` before worker's birth year + 8 | Reject at Zod boundary | `[CAL]` |
| `hoursPerDay > 12` | Clamp to 12, flag in record | `[CAL]` |
| All segments have `I_task = 0` | `CE = 0`, Tier 1, escalations still apply | `[CAL]` |

> **Open question — zero-segment workers.** A worker registered with no exposure history currently falls to `CE = 0` → Tier 1, which is indistinguishable from a genuinely low-exposure worker who was properly interviewed. `TSFE` is also undefined. These are different states and conflating them will quietly hide incomplete interviews inside the low-risk bucket.
>
> Recommended resolution: add an `insufficientData: boolean` field to `RiskResult` and render such workers in a distinct "Interview incomplete" state in the UI rather than as Tier 1. **This changes the output contract in the project brief and therefore needs sign-off before implementation.**

### 9.4 Explainability

`topContributors` is not optional and not a nicety. It is the mechanism by which a health worker can challenge the score, and the reason the system is auditable rather than a black box.

Default: top 3 contributing segments by absolute contribution, each with its percentage of total. `[CAL]`

Reason string templates:

```
EN: "{TierLabel} — {CE} mg/m³·years cumulative silica exposure,
     mainly {years} years of {taskLabelEn}.{escalationClause}
     Not a diagnosis."

HI: "{TierLabelHi} — संचयी सिलिका जोखिम {CE} mg/m³·वर्ष,
     मुख्यतः {taskLabelHi} के {years} वर्षों से।{escalationClauseHi}
     यह निदान नहीं है।"
```

Every rendered reason string, in both languages, must terminate in the non-diagnosis statement. This is enforced by test, not by convention.

Mandatory persistent UI notice wherever a score appears:

> **EN:** Exposure coefficients are provisional and pending field validation. This is not a diagnosis. Certification authority rests solely with the District Pneumoconiosis Board.
>
> **HI:** जोखिम गुणांक अनंतिम हैं और क्षेत्रीय सत्यापन की प्रतीक्षा में हैं। यह निदान नहीं है। प्रमाणन का अधिकार केवल जिला न्यूमोकोनियोसिस बोर्ड को है।

---

## 10. Threats to validity

Stated in the order a hostile technical reviewer would raise them.

1. **The JEM is invented.** Mitigated by the 0.12 mg/m³ anchoring constraint (§4.1) and by making the matrix editable and auditable, not by pretending otherwise. Remains the primary risk.
2. **Cohort curves applied to individuals.** Addressed by claiming only ordering, not individual risk (§1). The claim must stay narrow in every artefact — UI, README, video script.
3. **Recall bias in occupational history.** Workers self-report tasks and years, often across informal and unregistered quarries, sometimes decades back. There is no employer record to corroborate against — that absence is precisely why the registry is person-linked. Systematic under-reporting would bias the whole cohort downward. Unquantified and currently unmitigated.
4. **`peakIntensity >= 0.5` is dead code — the rule cannot fire at all** (§7.2). The matrix ceiling is 0.336 mg/m³. A specified safeguard that never triggers is worse than an absent one. Known, pinned by test, unresolved pending sign-off.
5. **The CXR sensitivity figure comes from the wrong population.** Hoy et al. studied **artificial stone benchtop workers** — engineered quartz, silica content far above natural sandstone, a young cohort with rapidly progressive disease. The 48% sensitivity figure is used here to justify not relying on radiography as a *selector*. It should not be presented as the sensitivity that would be observed in Rajasthan sandstone miners, and the README should carry this caveat too.
6. **Rescreen intervals are wholly unsourced** (§8).
7. **The overlap rule has no external justification** (§3.2) and materially affects multi-task workers, who are common.
8. **Escalation arithmetic is unconfirmed** (§7.1).
9. **No competing-risk handling.** Workers in this cohort face high TB mortality and, at 37.3% silicosis prevalence, many are already cases. The model has no notion of a worker who already has silicosis; such a worker scores as high-priority-for-screening when they in fact need treatment and certification. **Registry design should capture known prior silicosis certification and route those workers out of the screening funnel entirely.** This is arguably a gap in the data model, not just the risk model.

---

## 11. Versioning and change policy

`modelVersion` is emitted on every `RiskAssessment` and persisted. Assessments are never silently recomputed; a model change produces new assessment rows.

Semantic versioning on model behaviour:

- **Patch** — documentation, provenance, reason-string wording. No numeric output change.
- **Minor** — JEM coefficient revisions, new tasks, modifier changes. Cohort tier distribution may shift.
- **Major** — threshold changes, escalation logic changes, equation changes.

**Golden-file test:** 20 fixed synthetic worker profiles with committed expected outputs, covering each tier boundary from both sides, every escalation rule in isolation, the +2 escalation cap, the tier-4 hard cap, zero and single segment workers, overlapping segments, ongoing segments, and the `hoursPerDay` clamp.

Any diff to the golden file must be **deliberate, reviewed, and explained in the commit message.** An unexplained golden-file change is a defect, not a test update.

`confidence` remains hardcoded `'provisional'` until a retrospective validation against certified cases in the state portal exists. **Removing that hardcoding requires evidence, not a decision.**

---

## 12. References

1. **Howlett P, Gan J, Lesosky M, Feary J.** Relationship between cumulative silica exposure and silicosis: a systematic review and dose-response meta-analysis. *Thorax*. 2024;79(10):934–942. doi:10.1136/thorax-2024-221447. PMID: 39107111.
   — *Primary anchor for the 4.0 mg/m³·years boundary. 8 studies / 10 cohorts, 8,792 cases among 65,977 participants. Reference category 4 mg/m³·years = 40 years at 0.10 mg/m³; ~42% absolute risk in mining cohorts, 5.1% non-mining. 4→2 reduction: miners RR 0.23 (0.18–0.29), ARR 323/1000.*

2. **Howlett P, Durairaj A, Gan J, Lesosky M, Feary J.** Adjusting for the reduced sensitivity of CXR in the dose-response relationship between cumulative silica exposure and silicosis in miners. *medRxiv* preprint, 29 May 2025. doi:10.1101/2025.05.29.25328501.
   — **PREPRINT, NOT PEER REVIEWED. Must be labelled as such wherever cited.** *CXR sensitivity 0.76 (0.63–0.86) vs HRCT under fixed-sensitivity assumption. 4→2 ARR rises to 409 (fixed) / 557 (relative) per 1,000 vs 323 unadjusted. Effect most pronounced below ~6 mg/m³·years.*

3. **Hoy RF, et al.** Chest x-ray has low sensitivity to detect silicosis in artificial stone benchtop industry workers. *Respirology*. 2024;29(9):785–794. doi:10.1111/resp.14755.
   — *Sensitivity 48% (95% CI 29–68), specificity 97% (90–100) against HRCT, in 99 workers with ILO category 0 or 1. All 11 workers with ILO 2/3 had HRCT silicosis.* **Population caveat: artificial stone, not sandstone mining — see §10.5.**

4. **Buchanan D, Miller BG, Soutar CA.** Quantitative relations between exposure to respirable quartz and risk of silicosis. *Occup Environ Med*. 2003;60(3):159–164.
   — *Basis for a separate peak-intensity term. 371 Scottish colliery workers aged 50–74. 1 g·h·m⁻³ accrued above 2 mg/m³ ≈ 3 g·h·m⁻³ at lower concentrations. ~20% silicosis probability after 15 years at 0.3 mg/m³.*

5. **Prajapati SS, Nandi SS, Deshmukh A, Dhatrak SV.** Exposure profile of respirable crystalline silica in stone mines in India. *J Occup Environ Hyg*. 2020;17(11–12):531–537. doi:10.1080/15459624.2020.1798011. PMID: 32783703.
   — *The JEM's anchoring constraint. Sandstone mean RCS 0.12 mg/m³, mean respirable dust 0.47 mg/m³. Masonry 0.17 / 1.24; granite 0.17 / 3.28. India DGMS limit 0.15 mg/m³ — three to six times more permissive than OSHA/NIOSH (0.05) and ACGIH (0.025).*

6. **Rajavel S, Raghav P, Gupta MK, Muralidhar V.** Silico-tuberculosis, silicosis and other respiratory morbidities among sandstone mine workers in Rajasthan — a cross-sectional study. *PLoS ONE*. 2020;15(4):e0230574. doi:10.1371/journal.pone.0230574.
   — *The target population. Jodhpur district, 15 mines, 174 workers. Silicosis 37.3%, silicotuberculosis 7.4%, TB 10.0%. Mean tenure 18.88 ± 9.81 years; silicotic workers 26.37 years (range 15–35). Men: cutting/drilling 94.5%; women: loading/waste-cleaning 93.4%. Abnormal spirometry 89.2%, predominantly restrictive (78.0%).*

7. **Ehrlich R, et al.** The association between silica exposure, silicosis and tuberculosis: a systematic review and meta-analysis. PMC8136154.
   — *Silicosis + TB pooled RR 4.01 (95% CI 2.88–5.58); silica exposure controlling for/excluding silicosis RR 1.92 (95% CI 1.36–2.73).* **Citation needs journal/volume/page pinning.**

### Citations still required

- [ ] Full text of ref. 1 to resolve the 1.0 mg/m³·years boundary (§6.2)
- [ ] Dust suppression efficacy for `m_method` — **highest-value outstanding citation** (§5)
- [ ] Enclosure, PPE, and site modifiers (§5)
- [ ] ILO / WHO / DGMS surveillance intervals (§8)
- [ ] Full bibliographic details for ref. 7
- [ ] Task-stratified RCS measurements for Rajasthan sandstone — **may not exist; that gap is the project's stated contribution**

---

*Every coefficient in this model is provisional. Every threshold not marked `[LIT]` is a judgement made by one student with published numbers and no field data. That is stated here, in the UI, and in the README, because it is true and because a government technical review will establish it regardless.*
