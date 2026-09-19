# Research: Anchoring Heritability to the Living Population Ratchets Any Trait That Grows With Age

**Recorded:** 2026-09-19 | **Commit:** c7e8623 | **Latest ARD:** 064 | **Base config:** scaled commons + cut extraction (see Key context vars)
**Commands:** `npx ts-node drift-probe.ts 2000 8` (ad-hoc, see below); control run on the pre-ARD-064 tree via `git stash`
**Key context vars:** `HERITABILITY_RESIDUAL_SPREAD=1.0`, `HERITABILITY_MIN_SAMPLE=30`, `HERITABILITY_STAT_COEFFICIENT=0.4`, `HERITABILITY_INTENT_COEFFICIENT=0.25`, `INTELLIGENCE_MAX=20`, `STEALING_INTENT_CAP=0.8`

**Headline: ARD 064 fixes exactly the collapse it targeted, and introduces a runaway in the two
traits that grow during a person's life. It should not be merged as it stands.** Anchoring a
newborn's draw to the living population's mean is a positive feedback loop for any trait some event
raises with age: children inherit the *phenotypic* mean, which includes a lifetime of accumulation,
so each generation starts higher, accumulates more, and the mean ratchets until it hits a cap.

300 founders, 2000 ticks, scaled commons and cut extraction. Population mean per trait at run end,
against the pre-ARD-064 tree as a control:

| Trait | Founder mean | Control (ARD 037) | ARD 064 | Verdict |
|---|---|---|---|---|
| `learningIntent` | 0.500 | 0.014 | **0.383 – 0.630** | fixed |
| `killingIntent` | 0.050 | 0.014 | **0.035 – 0.076** | fixed |
| `intelligence` | 6.000 | 6.04 | **19.73 – 19.96** | **ratcheted to `INTELLIGENCE_MAX` = 20** |
| `stealingIntent` | 0.150 | 0.025 | **0.800 in every run, zero spread** | **ratcheted to `STEALING_INTENT_CAP` = 0.8** |

ARD 045's prosocial/antisocial asymmetry survives: `killingIntent < learningIntent` in 8 of 8 runs,
without being hard-coded anywhere. That was the risk the ARD named, and it is not what went wrong.

## What the two failures have in common

`learningIntent` and `killingIntent` are set at birth and never modified again. They hold near their
founder means, which is the whole point of the change.

`intelligence` and `stealingIntent` are both raised during life:

- `LearnEvent` increments `intelligence`, capped at `INTELLIGENCE_MAX`.
- `StealEvent` increments `stealingIntent` by `STEALING_EMBOLDEN_INCREMENT` on every undetected
  theft, capped at `STEALING_INTENT_CAP` (ARD 036 emboldening).

Under ARD 037 a constant anchor absorbed that: children were pulled back to 5.5 or to zero no matter
what their parents had accumulated. Anchoring to the live mean removes the brake, and lifetime gains
become heritable. `constitution` was not measured but has the same shape — `ExerciseEvent` raises it
against `CONSTITUTION_MAX` — and should be assumed to ratchet too until checked.

**The model conflates endowment with accumulated state in one field.** A 70-year-old's
`intelligence` of 20 is a lifetime of learning, not a heritable endowment, but the draw cannot tell
the difference because there is only one number. ARD 064 is correct that offspring regress toward a
population mean; it is wrong about *which* mean, because the phenotypic mean is not the endowment
mean once a trait grows with age.

## Incidentally: a cap that was dead is now fully binding

`docs/future-ideas.md` records `STEALING_INTENT_CAP` as unreachable — measured on the pre-ARD-064
tree, 0 of 178,473 adult observations came within reach of 0.8, and the maximum seen was 0.555. Under
ARD 064 the population mean sits at exactly 0.800 in every run. The cap went from decorative to
load-bearing on one change to an unrelated subsystem, which is the argument for auditing the model's
caps rather than reasoning about them one at a time.

## What to do about it

Not settled here — this is a new decision, and the ARD is explicit that an adverse measurement is not
a licence to quietly re-add an anchor constant. The obvious candidate is to anchor on a **young
cohort** rather than the whole living population: people below some age have accumulated little, so
their mean approximates the endowment mean the draw actually wants. That reintroduces one constant
(the cohort age), but a meaningful one rather than a per-trait magic number, and it keeps everything
ARD 064 got right. Separating endowment from accumulated state into two fields is the thorough fix
and a much larger change.

## Caveats

- 8 seeds at 2000 ticks for the treatment, 4 for the control. The effects are large enough that
  sample size is not the question — `stealingIntent` is at the cap in every run with zero spread —
  but nothing here is a paired test, and the trait means were not compared with `scripts/compare.ts`.
- `constitution` and `exerciseIntent` were not measured.
- The probe was ad-hoc and is not committed; `Simulation.traitDistribution` makes it a few lines to
  rebuild.
