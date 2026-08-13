# JEM_SOURCES.md — Provenance for every exposure coefficient

**Matrix version:** `jem-raj-sandstone-0.1.0`
**Implements:** [`src/lib/risk/jem.ts`](../src/lib/risk/jem.ts)
**Specification:** [`docs/RISK_MODEL.md`](./RISK_MODEL.md) §4, §5
**Last reviewed:** 2026-08-13

---

## Status, stated plainly

**All twelve entries are `provisional`. Not one is a measurement.**

No task-stratified respirable crystalline silica measurement for Rajasthan sandstone workers has been published. That gap is the single largest technical risk in SilicoTrack and is also the project's main intended contribution.

What this matrix therefore is: **an apportionment of one measured number across twelve tasks.** The measured number is real and cited. The apportionment is expert judgement and is not.

What it is not: a set of measurements. Nothing in this file may be presented as one.

---

## 1. The one real number

> **Prajapati SS, Nandi SS, Deshmukh A, Dhatrak SV.** Exposure profile of respirable crystalline silica in stone mines in India. *J Occup Environ Hyg*. 2020;17(11–12):531–537. doi:10.1080/15459624.2020.1798011. PMID: 32783703.

| Mine type | Mean RCS (mg/m³) | Mean respirable dust (mg/m³) | RCS as % of dust |
|---|---|---|---|
| **Sandstone** | **0.12** | 0.47 | **25.5%** |
| Masonry stone | 0.17 | 1.24 | 13.7% |
| Granite | 0.17 | 3.28 | 5.2% |

India's DGMS permissible limit is **0.15 mg/m³** — three to six times more permissive than OSHA/NIOSH (0.05) and ACGIH (0.025). The study's authors call for revision.

### Two consequences for this matrix

**(a) Sandstone dust is ~26% crystalline silica — the highest fraction of the three stone types**, despite having the lowest absolute dust. Sandstone is largely quartz, so this is chemically expected.

> **Conversion warning.** Any future JEM entry sourced from a *respirable dust* measurement must be multiplied by the silica fraction before entry. For sandstone that factor is ≈ 0.26. **A generic cross-stone conversion factor is wrong by up to 5×** — applying granite's 5.2% to a sandstone measurement would understate exposure fivefold. Record the factor used in the entry's `source` string.

**(b) A worker can be DGMS-compliant and still reach Tier 4.** At the measured mean of 0.12 mg/m³ — comfortably under the 0.15 limit — a worker accumulates 4.0 mg/m³·years in about 33 years. The matrix must not treat the Indian PEL as a safety threshold, and neither must the UI.

---

## 2. Workforce structure

> **Rajavel S, Raghav P, Gupta MK, Muralidhar V.** Silico-tuberculosis, silicosis and other respiratory morbidities among sandstone mine workers in Rajasthan — a cross-sectional study. *PLoS ONE*. 2020;15(4):e0230574. doi:10.1371/journal.pone.0230574.

Jodhpur district, 15 mines, 174 workers.

| Finding | Value |
|---|---|
| Male workers: stone cutting, drilling, or both | 94.5% |
| Female workers: loading stone, cleaning stone waste, or both | 93.4% |
| Mean tenure | 18.88 ± 9.81 years |
| Silicosis prevalence | 37.3% |

This is what determines **which tasks the matrix must cover**, and it is why `CUT_DRY`, `CUT_WET` and `CLEAN_WASTE` were added beyond the eight tasks originally specified — see §6.

**Sex is not a model input.** The task split above is documented and real, but sex is only a proxy for task, and task is measured directly in the interview. Encoding sex would import the proxy and its error while adding nothing.

---

## 3. The anchoring constraint

The matrix is not free to take arbitrary values. From `RISK_MODEL.md` §4.1:

> An FTE-weighted average of `I_task` across a realistic Rajasthan sandstone **mine** task mix must reproduce approximately **0.12 mg/m³**.

This is enforced in code, not by good intentions — `MINE_TASK_MIX`, `weightedMeanIntensity()`, `ANCHOR_TARGET_MG_M3` and `ANCHOR_TOLERANCE_MG_M3` are exported from `jem.ts` so a test can assert it.

### Current arithmetic

| Task | FTE weight | Intensity | Contribution |
|---|---|---|---|
| `DRILL_DRY` | 0.15 | 0.28 | 0.0420 |
| `DRILL_WET` | 0.05 | 0.05 | 0.0025 |
| `CUT_DRY` | 0.25 | 0.18 | 0.0450 |
| `CUT_WET` | 0.05 | 0.04 | 0.0020 |
| `DRESS` | 0.10 | 0.12 | 0.0120 |
| `LOAD` | 0.20 | 0.05 | 0.0100 |
| `HAUL` | 0.10 | 0.025 | 0.0025 |
| `CLEAN_WASTE` | 0.10 | 0.07 | 0.0070 |
| **Total** | **1.00** | | **0.1230** |

**Weighted mean 0.1230 mg/m³ against a target of 0.12, tolerance ±0.02. Constraint satisfied.** *(Verified 2026-08-13.)*

`CARVE` and `POLISH` are excluded from the anchor: they are downstream processing tasks, not mine tasks, and therefore lie outside the population Prajapati et al. sampled. They are consequently the two **least** constrained entries in the matrix.

**The FTE weights are themselves a calibration choice.** Rajavel et al. report role proportions by sex, not time-allocation across tasks. The weights are consistent with that structure but are not measured. Changing them changes what the anchor certifies.

---

## 4. Per-entry provenance

`M` = wet/dry suppression already encoded in the value (see §5).

| Task code | Label (EN) | Label (HI) | mg/m³ | Range | M | Confidence | Basis for the value |
|---|---|---|---|---|---|---|---|
| `DRILL_DRY` | Dry drilling | सूखी ड्रिलिंग | **0.28** | 0.10 – 0.75 | ✔ | `provisional` | Highest routine mine task. High energy directly into rock at the breathing zone, typically unsuppressed. Set as the matrix ceiling for mine work. |
| `DRILL_WET` | Wet drilling | गीली ड्रिलिंग | **0.05** | 0.015 – 0.15 | ✔ | `provisional` | Water-at-the-bit suppression. Ratio to `DRILL_DRY` = **0.18** (~82% reduction). ⚠ See §5.2 — conflicts with the generic modifier. |
| `CUT_DRY` | Dry cutting / sawing | सूखी कटाई | **0.18** | 0.06 – 0.50 | ✔ | `provisional` | Below dry drilling: lower energy per unit rock removed, less point-source generation at the face. Highest-weight task in the anchor mix (0.25 FTE). |
| `CUT_WET` | Wet cutting / sawing | गीली कटाई | **0.04** | 0.01 – 0.12 | ✔ | `provisional` | Ratio to `CUT_DRY` = 0.22. Slightly less effective than wet drilling: blade suppression wets a larger, more open work area. |
| `DRESS` | Stone dressing | पत्थर घड़ाई | **0.12** | 0.04 – 0.32 | ✘ | `provisional` | Hand/pneumatic chiselling to square a block. Sustained and close to the face, but far lower energy input than drilling. |
| `CARVE` | Carving | नक्काशी | **0.15** | 0.05 – 0.40 | ✘ | `provisional` | Placed **above** `DRESS` despite lower energy input — carving is typically done in small, poorly ventilated workshops over long continuous shifts, so dust accumulates rather than disperses. ⚠ Outside the anchor. |
| `CRUSH` | Crushing | पत्थर पिसाई | **0.22** | 0.08 – 0.55 | ✘ | `provisional` | Mechanical comminution generates a high fines fraction; operators are frequently stationed downwind of their own plant. Second-highest entry. |
| `POLISH` | Polishing / grinding | घिसाई एवं पॉलिश | **0.17** | 0.05 – 0.45 | ✘ | `provisional` | Dry abrasive finishing. Particle size skews fine — the alveolar-depositing fraction — so respirable share exceeds what the visible cloud suggests. ⚠ Outside the anchor. |
| `LOAD` | Loading | पत्थर लदान | **0.05** | 0.02 – 0.15 | ✘ | `provisional` | Re-suspension of settled dust, not primary generation. Carries a large share of the female workforce (93.4% in loading/waste clearing). |
| `HAUL` | Hauling / transport | ढुलाई | **0.025** | 0.01 – 0.08 | ✘ | `provisional` | Matrix floor. Partial cab enclosure, but unsealed haul roads keep it non-zero. **No entry in this matrix is zero.** |
| `CLEAN_WASTE` | Waste / debris clearing | पत्थर मलबे की सफाई | **0.07** | 0.02 – 0.20 | ✘ | `provisional` | Above `LOAD`: handling accumulated fines rather than cut blocks, so the material moved is already respirable-enriched. |
| `OTHER` | Other sandstone work | अन्य कार्य | **0.12** | 0.04 – 0.30 | ✘ | `provisional` | Set deliberately **at** the measured sandstone mean, so an unclassified task scores as an average worker. An unknown task must never be a free pass out of screening. |

**Every row's `source` field in code carries the same declaration:** point estimate apportioned from Prajapati et al. 2020; relative ordering from mechanistic reasoning about dust generation, energy input and enclosure; no task-stratified measurement exists.

### On the ranges

`rangeLow` / `rangeHigh` are **plausible bounds, not confidence intervals.** There is no sampling distribution behind them because there was no sampling. They are roughly a third to triple the point estimate, widening for tasks further from the anchor. They exist to drive the admin screen's sensitivity view — showing how the cohort's tier distribution shifts across the plausible range is the honest way to present a provisional matrix.

---

## 5. Two hazards carried in this matrix

### 5.1 Double-counting wet/dry suppression — guarded

Four entries encode method in the task code itself (`DRILL_DRY`/`DRILL_WET`, `CUT_DRY`/`CUT_WET`). The risk model separately defines an `m_method` control modifier of 0.50 for wet methods.

**If both are applied, suppression is counted twice.** `DRILL_WET` at 0.05 becomes 0.025 — a silent 2× error, in the direction of under-triage, landing on exactly the workers the system exists to find.

The guard is the `methodEncoded: boolean` field on `JemEntry`. **The engine must skip `m_method` when it is true.** This needs an explicit test; it is the kind of defect that produces plausible-looking output indefinitely.

### 5.2 Two different claims about how well water works — unresolved

| Source of claim | Implied reduction |
|---|---|
| `RISK_MODEL.md` §5, generic `m_method` modifier | 50% |
| This matrix, `DRILL_WET` : `DRILL_DRY` | 82% |
| This matrix, `CUT_WET` : `CUT_DRY` | 78% |

Both are provisional and they disagree by a wide margin. The task-pair ratios are the more considered estimate — water applied at the point of generation is genuinely more effective than a blanket modifier implies — but neither is sourced.

**This is the highest-value outstanding citation in the entire project.** Wet suppression is the single largest controllable term in the exposure equation and the model's principal actionable recommendation. Sourcing it matters more than refining any individual `I_task`.

---

## 6. Deviation from the requested task list

Eight tasks were specified: dry drilling, wet drilling, dressing, carving, crushing, loading, hauling, polishing. All eight are present.

**Four entries were added**, flagged here rather than slipped in:

| Added | Why |
|---|---|
| `CUT_DRY`, `CUT_WET` | Rajavel et al. found **94.5% of male Jodhpur sandstone workers** did "stone cutting, drilling **or both**". A matrix without cutting cannot represent the majority of the male workforce, and seed data would have to misclassify them as drilling — inflating scores. |
| `CLEAN_WASTE` | Paired with loading, this covers **93.4% of female workers** in the same study. Without it the entire female cohort collapses into `LOAD`. |
| `OTHER` | The engine needs a total function at the DB/sync boundary. Without a fallback, an unrecognised task code either throws — dropping a worker out of the screening queue — or silently scores zero. |

Delete these four if unwanted; nothing else depends on them structurally. The cost is that the anchor mix loses 40% of its FTE weight and would need reweighting.

---

## 7. Outstanding citations

Ordered by value to the model.

- [ ] **Wet suppression efficacy** for `m_method` and the wet/dry task pairs — see §5.2. Highest priority.
- [ ] **Task-stratified RCS measurement for Rajasthan sandstone.** May not exist. If so, generating it is the project's contribution, and the roadmap should say that explicitly rather than implying it can be cited.
- [ ] Enclosure, PPE and site control modifiers (`RISK_MODEL.md` §5) — all `[PROVISIONAL]`.
- [ ] Published RCS ranges for analogous tasks in **other** stone sectors, to bound `rangeLow`/`rangeHigh` with something better than judgement.
- [ ] Workshop-based carving and polishing measurements — the two entries the anchor does not constrain.
- [ ] Silica fraction of respirable dust for Rajasthan sandstone specifically, to firm up the 25.5% conversion factor in §1.

---

## 8. How to change a value

The matrix is intended to be edited by domain experts through the admin screen. That is the design response to its provisional status: make the uncertainty inspectable and correctable rather than hiding it.

1. Update the entry in `src/lib/risk/jem.ts`, including `source`, `confidence` and `lastReviewed`.
2. **Update the row in §4 of this file.** An undocumented coefficient change is a defect.
3. Re-run the anchoring check (§3). If it now fails, either rebalance or justify the deviation here in writing.
4. Bump `JEM_VERSION` — minor for coefficient changes, major for added or removed tasks.
5. Re-run the golden-file test. Expect diffs; every one must be deliberate and explained in the commit message.
6. If a value gains a real citation, raise `confidence` off `provisional` **for that entry only**. Do not raise the others by association.

> **Do not quietly harden provisional numbers into confident ones.** A reviewer who finds one unmarked estimate will reasonably assume there are others. The honesty here is a scored asset, not a liability.

---

## 9. Change log

| Version | Date | Change |
|---|---|---|
| `0.1.0` | 2026-08-13 | Initial matrix. Twelve entries, all `provisional`. Anchored to Prajapati et al. 2020 sandstone mean of 0.12 mg/m³; weighted mean 0.1230. No entry carries a task-specific citation. |
